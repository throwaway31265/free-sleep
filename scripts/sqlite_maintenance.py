"""Back up or rebuild a Free Sleep SQLite database without changing its schema."""

import argparse
from contextlib import closing
import hashlib
import json
import math
import os
from pathlib import Path
import sqlite3
import tempfile


def quote_identifier(identifier):
    return '"' + identifier.replace('"', '""') + '"'


def check_integrity(connection):
    findings = connection.execute('PRAGMA integrity_check').fetchall()
    if findings != [('ok',)]:
        raise ValueError(f'Database integrity check failed: {findings[:5]}')


def temporary_database(destination):
    descriptor, filename = tempfile.mkstemp(prefix=destination.name + '.', dir=destination.parent)
    os.close(descriptor)
    return Path(filename)


def backup_database(source, destination, checkpoint=False):
    """Verify a consistent SQLite backup before replacing the previous backup."""
    source, destination = Path(source).resolve(), Path(destination).resolve()
    if source == destination:
        raise ValueError('Source and destination must be different files')
    temporary_path = temporary_database(destination)
    try:
        with closing(sqlite3.connect(source.as_uri() + '?mode=rw', uri=True, timeout=10)) as original:
            with closing(sqlite3.connect(temporary_path)) as backup:
                original.backup(backup)
                check_integrity(backup)
            if checkpoint:
                # Maintenance callers stop all writers first; never discard pending WAL data.
                busy, wal_pages, copied_pages = original.execute('PRAGMA wal_checkpoint(TRUNCATE)').fetchone()
                if busy or wal_pages != copied_pages:
                    raise ValueError('Database checkpoint is busy; leave the WAL intact and retry')
        temporary_path.chmod(source.stat().st_mode & 0o777)
        os.replace(temporary_path, destination)
    finally:
        temporary_path.unlink(missing_ok=True)


def invalid_row_reason(columns, record):
    """Reject records decoded with the wrong table layout while keeping valid metrics."""
    for column, value in zip(columns, record):
        _, name, declared_type, required, _, primary_key = column
        if value is None:
            if required or primary_key:
                return f'{name} is NULL'
            continue
        declared_type = declared_type.upper()
        if any(affinity in declared_type for affinity in ('CHAR', 'CLOB', 'TEXT')):
            if not isinstance(value, str):
                return f'{name} must contain text'
        elif any(affinity in declared_type for affinity in ('INT', 'REAL', 'FLOA', 'DOUB')):
            if not isinstance(value, (int, float)) or not math.isfinite(value):
                return f'{name} must contain a finite number'
        if name == 'side' and value not in ('left', 'right'):
            return 'side must be left or right'
        if name in ('id', 'timestamp', 'entered_bed_at', 'left_bed_at') and 'INT' in declared_type:
            if not isinstance(value, int):
                return f'{name} must contain an integer'
        if name in ('present_intervals', 'not_present_intervals'):
            try:
                intervals = json.loads(value)
                if not isinstance(intervals, list):
                    return f'{name} must contain a JSON list'
            except (TypeError, ValueError):
                return f'{name} contains invalid JSON'
    return None


def record_fingerprint(record):
    encoded = json.dumps(record, separators=(',', ':'), ensure_ascii=True).encode()
    return int.from_bytes(hashlib.sha256(encoded).digest(), 'big')


def recover_database(source, destination, immutable=False):
    """Rebuild readable table rows, then verify schema, indexes, and every retained value."""
    source, destination = Path(source).resolve(), Path(destination).resolve()
    if destination.exists():
        raise ValueError('Recovery destination already exists; choose a new file')
    wal_path = Path(str(source) + '-wal')
    if immutable and wal_path.exists() and wal_path.stat().st_size:
        raise ValueError('Immutable recovery requires a standalone snapshot without pending WAL data')
    temporary_path = temporary_database(destination)
    report = {'source': str(source), 'destination': str(destination), 'tables': {}}
    try:
        source_uri = source.as_uri() + '?mode=ro' + ('&immutable=1' if immutable else '')
        with closing(sqlite3.connect(source_uri, uri=True)) as original:
            original.execute('BEGIN')
            schema = original.execute(
                "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL "
                "AND name NOT LIKE 'sqlite_%' ORDER BY type, name"
            ).fetchall()
            with closing(sqlite3.connect(temporary_path)) as recovered:
                recovered.execute('BEGIN')
                for object_type, table_name, statement in schema:
                    if object_type != 'table':
                        continue
                    recovered.execute(statement)
                    quoted_table = quote_identifier(table_name)
                    columns = original.execute(f'PRAGMA table_info({quoted_table})').fetchall()
                    placeholders = ','.join('?' for _ in columns)
                    stats = {'scanned': 0, 'retained': 0, 'rejected': []}
                    expected_fingerprint = 0
                    for record in original.execute(f'SELECT * FROM {quoted_table} NOT INDEXED'):
                        stats['scanned'] += 1
                        reason = invalid_row_reason(columns, record)
                        if reason:
                            stats['rejected'].append({'id': record[0], 'reason': reason})
                            continue
                        # Conflicting keys abort recovery; never silently drop valid records.
                        recovered.execute(f'INSERT INTO {quoted_table} VALUES ({placeholders})', record)
                        expected_fingerprint += record_fingerprint(record)
                        stats['retained'] += 1
                    actual_fingerprint = sum(
                        record_fingerprint(record)
                        for record in recovered.execute(f'SELECT * FROM {quoted_table} NOT INDEXED')
                    )
                    actual_count = recovered.execute(f'SELECT count(*) FROM {quoted_table}').fetchone()[0]
                    if actual_fingerprint != expected_fingerprint or actual_count != stats['retained']:
                        raise ValueError(f'Recovered values differ for {table_name}')
                    report['tables'][table_name] = stats
                for object_type, _, statement in schema:
                    if object_type != 'table':
                        recovered.execute(statement)
                if original.execute("SELECT 1 FROM sqlite_master WHERE name='sqlite_sequence'").fetchone():
                    # Preserve high-water marks so deleted or lost IDs are never reused.
                    for table_name, sequence in original.execute('SELECT name, seq FROM sqlite_sequence'):
                        updated = recovered.execute('UPDATE sqlite_sequence SET seq=max(seq, ?) WHERE name=?',
                                                    (sequence, table_name))
                        if not updated.rowcount:
                            recovered.execute('INSERT INTO sqlite_sequence(name, seq) VALUES (?, ?)',
                                              (table_name, sequence))
                recovered.commit()
                check_integrity(recovered)
                if recovered.execute('PRAGMA foreign_key_check').fetchall():
                    raise ValueError('Recovered database has broken foreign keys')
                recovered_schema = recovered.execute(
                    "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL "
                    "AND name NOT LIKE 'sqlite_%' ORDER BY type, name"
                ).fetchall()
                if recovered_schema != schema:
                    raise ValueError('Recovered schema differs from the original')
            original.rollback()
        temporary_path.chmod(source.stat().st_mode & 0o777)
        os.replace(temporary_path, destination)
        report['integrity_check'] = 'ok'
        return report
    finally:
        temporary_path.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', choices=('backup', 'recover'))
    parser.add_argument('source', type=Path)
    parser.add_argument('destination', type=Path)
    parser.add_argument('--checkpoint', action='store_true',
                        help='After backup, checkpoint the source; stop all writers first')
    parser.add_argument('--immutable', action='store_true',
                        help='Recover a standalone, frozen snapshot with no pending WAL data')
    args = parser.parse_args()
    if args.operation == 'backup':
        if args.immutable:
            parser.error('--immutable is only supported for recovery')
        backup_database(args.source, args.destination, args.checkpoint)
        print(f'Verified SQLite backup: {args.destination}')
    else:
        if args.checkpoint:
            parser.error('--checkpoint is only supported for backup')
        print(json.dumps(recover_database(args.source, args.destination, args.immutable), indent=2))


if __name__ == '__main__':
    main()
