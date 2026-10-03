# SQLite maintenance

`sqlite_maintenance.py` uses Python's standard library. It does not require the SQLite CLI or biometric Python packages.

Create a verified backup, including committed records still in the WAL:

```sh
python3 scripts/sqlite_maintenance.py backup /path/free-sleep.db /path/backup.db
```

The previous backup is replaced only after the new backup passes `PRAGMA integrity_check`. A corrupt source leaves the previous backup intact. Maintenance scripts stop both Free Sleep services before using `--checkpoint`, which asks SQLite to flush the source WAL and rejects a busy checkpoint. Journal files must remain available for SQLite recovery; do not delete them to clear a lock.

Rebuild a frozen, standalone snapshot of a corrupt database:

```sh
python3 scripts/sqlite_maintenance.py recover /path/snapshot.db /path/recovered.db --immutable > /path/recovery.json
```

Use `--immutable` only for a snapshot with no pending WAL transactions. For a database with journals, first stop its writers, preserve the original database and journals together, and use SQLite's backup API to create a standalone snapshot. Unlike the verified `backup` command, the raw backup API can preserve a corrupt database for recovery.

Recovery scans table pages without using corrupt indexes, rejects records with incompatible values, recreates the original schema and indexes, and preserves autoincrement high-water marks. It checks the count and fingerprint of every retained record, database integrity, and foreign keys before publishing the new file. Conflicting keys or unreadable table pages abort recovery. Existing destination files are never overwritten. The JSON report lists retained counts and rejected record IDs; readable records are not a guarantee that all historical data survived the original corruption.

Replace a live database only with both `free-sleep` and `free-sleep-stream` stopped and no remaining database users. Preserve any journals with the old database before the replacement, set the new database's ownership to `dac:dac`, and check `/api/serverStatus` and biometric writes after restarting both services.

The installer deploys the updater wrapper and backup helper under `/persistent/free-sleep-maintenance/`. A systemd drop-in runs that wrapper so its service-stop and checkpoint protection also covers older downloaded installers.

Run regression tests with:

```sh
python3 -m unittest discover -s scripts/tests -v
```
