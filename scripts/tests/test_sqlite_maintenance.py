"""Run with python3 -m unittest discover -s scripts/tests."""

import importlib.util
import os
from pathlib import Path
import sqlite3
import subprocess
import tempfile
import unittest


scripts_path = Path(__file__).resolve().parents[1]
module_spec = importlib.util.spec_from_file_location('sqlite_maintenance', scripts_path / 'sqlite_maintenance.py')
maintenance = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(maintenance)


class SQLiteMaintenanceTests(unittest.TestCase):
    def setUp(self):
        self.temporary_folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary_folder.cleanup)
        self.folder = Path(self.temporary_folder.name)
        self.source = self.folder / 'source.db'
        self.destination = self.folder / 'destination.db'

    def create_metrics_database(self):
        connection = sqlite3.connect(self.source)
        connection.executescript('''
            CREATE TABLE movement (
                id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                timestamp INTEGER NOT NULL, side TEXT NOT NULL, total_movement INTEGER NOT NULL
            );
            CREATE UNIQUE INDEX movement_side_timestamp_key ON movement(side, timestamp);
            CREATE INDEX movement_side_timestamp_idx ON movement(side, timestamp);
            INSERT INTO movement VALUES (1, 1766089086, 'left', 58);
            INSERT INTO movement VALUES (2, 1766089146, 'right', 62);
            INSERT INTO movement VALUES (99, 1766089206, 'left', 0);
            DELETE FROM movement WHERE id=99;
        ''')
        return connection

    def test_backup_includes_committed_wal_records(self):
        original = self.create_metrics_database()
        self.addCleanup(original.close)
        original.execute('PRAGMA journal_mode=WAL')
        original.execute('PRAGMA wal_autocheckpoint=0')
        original.execute("INSERT INTO movement VALUES (100, 1766089266, 'left', 80)")
        original.commit()
        self.assertGreater(Path(str(self.source) + '-wal').stat().st_size, 0)
        maintenance.backup_database(self.source, self.destination)
        with sqlite3.connect(self.destination) as backup:
            self.assertEqual(backup.execute('SELECT count(*) FROM movement').fetchone()[0], 3)
            maintenance.check_integrity(backup)

    def test_failed_backup_preserves_previous_backup(self):
        self.source.write_bytes(b'broken database')
        self.destination.write_bytes(b'previous good backup')
        with self.assertRaises(sqlite3.DatabaseError):
            maintenance.backup_database(self.source, self.destination)
        self.assertEqual(self.destination.read_bytes(), b'previous good backup')
        self.assertEqual(sorted(path.name for path in self.folder.iterdir()), ['destination.db', 'source.db'])

    def test_recovery_preserves_schema_values_and_sequence(self):
        original = self.create_metrics_database()
        original.close()
        report = maintenance.recover_database(self.source, self.destination)
        self.assertEqual(report['tables']['movement']['retained'], 2)
        self.assertEqual(report['tables']['movement']['rejected'], [])
        with sqlite3.connect(self.destination) as recovered:
            self.assertEqual(recovered.execute('SELECT * FROM movement ORDER BY id').fetchall(),
                             [(1, 1766089086, 'left', 58), (2, 1766089146, 'right', 62)])
            self.assertEqual(recovered.execute('SELECT seq FROM sqlite_sequence').fetchone()[0], 99)
            recovered.execute("INSERT INTO movement(timestamp,side,total_movement) VALUES (1766089326,'left',1)")
            self.assertEqual(recovered.execute('SELECT max(id) FROM movement').fetchone()[0], 100)
            with self.assertRaises(sqlite3.IntegrityError):
                recovered.execute("INSERT INTO movement(timestamp,side,total_movement) VALUES (1766089086,'left',1)")

    def test_recovery_rejects_vitals_rows_decoded_as_movement(self):
        original = self.create_metrics_database()
        original.execute('INSERT INTO movement VALUES (3, ?, ?, ?)', ('left', 1766089386, 58))
        original.commit()
        original.close()
        report = maintenance.recover_database(self.source, self.destination)
        self.assertEqual(report['tables']['movement']['scanned'], 3)
        self.assertEqual(report['tables']['movement']['retained'], 2)
        self.assertEqual(report['tables']['movement']['rejected'][0]['id'], 3)
        with sqlite3.connect(self.source) as original:
            self.assertEqual(original.execute('SELECT count(*) FROM movement').fetchone()[0], 3)

    def test_immutable_recovery_refuses_pending_wal(self):
        original = self.create_metrics_database()
        self.addCleanup(original.close)
        original.execute('PRAGMA journal_mode=WAL')
        original.execute("INSERT INTO movement VALUES (100, 1766089266, 'left', 80)")
        original.commit()
        with self.assertRaisesRegex(ValueError, 'pending WAL'):
            maintenance.recover_database(self.source, self.destination, immutable=True)
        self.assertFalse(self.destination.exists())

    def test_recovery_refuses_to_overwrite_existing_database(self):
        original = self.create_metrics_database()
        original.close()
        self.destination.write_bytes(b'keep this database')
        with self.assertRaisesRegex(ValueError, 'already exists'):
            maintenance.recover_database(self.source, self.destination)
        self.assertEqual(self.destination.read_bytes(), b'keep this database')

    def test_recovery_preserves_sequence_for_an_empty_table(self):
        original = self.create_metrics_database()
        original.execute('DELETE FROM movement')
        original.commit()
        original.close()
        maintenance.recover_database(self.source, self.destination)
        with sqlite3.connect(self.destination) as recovered:
            self.assertEqual(recovered.execute('SELECT seq FROM sqlite_sequence').fetchone()[0], 99)

    def test_installer_stops_both_services_and_restores_them_on_failure(self):
        # Exercise the actual installer prefix without downloading or installing anything.
        systemctl_path = self.folder / 'systemctl'
        systemctl_path.write_text('#!/bin/sh\nprintf "%s\\n" "$*" >> "$SERVICE_LOG"\nexit 0\n')
        systemctl_path.chmod(0o755)
        log_path = self.folder / 'services.log'
        environment = dict(os.environ, PATH=str(self.folder) + ':' + os.environ['PATH'], SERVICE_LOG=str(log_path))
        prefix = (scripts_path / 'install.sh').read_text().split('# Download the repository')[0]
        result = subprocess.run(['bash'], input=prefix + '\nfalse\n', text=True, env=environment,
                                capture_output=True)
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertEqual(log_path.read_text().splitlines(), [
            'is-active --quiet free-sleep-stream', 'stop free-sleep-stream',
            'is-active --quiet free-sleep', 'stop free-sleep',
            'start free-sleep', 'start free-sleep-stream',
        ])


if __name__ == '__main__':
    unittest.main()
