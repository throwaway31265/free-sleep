# Database Migrations Guide

This document explains how to safely run Prisma database migrations for the Free Sleep project, especially on the pod where SQLite database locks can occur.

## Table of Contents
- [Overview](#overview)
- [The Problem](#the-problem)
- [The Solution](#the-solution)
- [Usage](#usage)
- [Troubleshooting](#troubleshooting)
- [Advanced Usage](#advanced-usage)

---

## Overview

Free Sleep uses [Prisma](https://www.prisma.io/) as the ORM and SQLite as the database. The database is located at:
- **Pod**: `/persistent/free-sleep-data/free-sleep.db`
- **Local Development**: `server/prisma/free-sleep-data/free-sleep.db`

---

## The Problem

When running migrations directly (e.g., `bun run migrate deploy`), you may encounter this error:

```
Error: SQLite database error
database is locked
```

**Why this happens:**
- SQLite only allows one writer at a time
- The `free-sleep` and `free-sleep-stream` services are running and holding database connections
- The migration cannot acquire a lock while these services are active

---

## The Solution

We've created a **migration wrapper script** (`scripts/migrate.sh`) that:

1. ✅ Detects if running on pod or local environment
2. ✅ Automatically stops services before migration (pod only)
3. ✅ Runs the Prisma migration safely
4. ✅ Restarts services after completion
5. ✅ Provides clear error messages and feedback

---

## Usage

### On the Pod (Remote)

**Method 1: Using the wrapper script directly**

```bash
# SSH into your pod
ssh root@<POD_IP> -p 8822

# Navigate to the server directory
cd /home/dac/free-sleep/server

# Run migration with a descriptive name
bash ../scripts/migrate.sh add_new_feature
```

**Method 2: Using npm/bun scripts**

```bash
# For the "deploy" migration (used during installation)
bun run migrate:deploy

# For custom migration names, use the script directly
bash ../scripts/migrate.sh your_migration_name
```

### Local Development

```bash
# Navigate to the server directory
cd server

# Run migration (no services to stop locally)
bash ../scripts/migrate.sh add_new_feature local
```

Or use the package.json script:

```bash
bun run migrate:local your_migration_name
```

---

## Troubleshooting

### Check Database Lock Status

We provide a diagnostic tool to check if the database is locked:

```bash
# On the pod
bash /home/dac/free-sleep/scripts/check_db_lock.sh
```

This will show:
- ✅ Database file status
- ✅ Active WAL files (indicates active connections)
- ✅ Processes accessing the database
- ✅ Service status
- ✅ Recommended actions

### Manual Service Management

If you need to manually manage services:

```bash
# Stop services
sudo systemctl stop free-sleep free-sleep-stream

# Check if they're stopped
sudo systemctl status free-sleep
sudo systemctl status free-sleep-stream

# Run your migration
bun run migrate:direct <migration_name>

# Start services again
sudo systemctl start free-sleep free-sleep-stream
```

### Common Errors

#### "database is locked"
- **Cause**: Services are running or database has active connections
- **Solution**: Use the migration wrapper script (`migrate.sh`) which handles this automatically

#### "Migration failed"
- **Cause**: Various - syntax error, constraint violation, etc.
- **Solution**: Check the error message carefully. The wrapper script will still restart services even if migration fails.

#### "Service did not stop cleanly"
- **Cause**: Service is taking too long to shut down
- **Solution**: The script will force-kill after timeout. If this happens repeatedly, check service logs.

---

## Advanced Usage

### Direct Prisma Access (Not Recommended)

If you need to bypass the wrapper and run Prisma directly:

```bash
# Stop services first!
sudo systemctl stop free-sleep free-sleep-stream

# Run Prisma command
dotenv -e .env.pod -- bun x prisma migrate dev --name <name>

# Start services again
sudo systemctl start free-sleep free-sleep-stream
```

### Migration During Installation

The `install.sh` script automatically runs migrations using the wrapper:

```bash
# In install.sh (line 526)
bun run migrate:deploy
```

This calls `migrate.sh` with "deploy" as the migration name.

### Prisma Commands

Other useful Prisma commands (run these when services are stopped):

```bash
# Generate Prisma Client
bun run generate

# View migration status
dotenv -e .env.pod -- bun x prisma migrate status

# Reset database (⚠️ DESTROYS ALL DATA)
bun run migrate:reset
```

---

## Package.json Scripts Reference

| Script | Description | Environment |
|--------|-------------|-------------|
| `bun run migrate:deploy` | Run "deploy" migration safely | Pod |
| `bun run migrate:local` | Run migration locally | Local |
| `bun run migrate:direct <name>` | Run Prisma directly (⚠️ manual service stop required) | Pod |
| `bun run migrate:reset` | Reset database (⚠️ DESTROYS DATA) | Pod |
| `bun run generate` | Generate Prisma Client | Both |
| `bun run check-db-lock` | Check database lock status | Pod |

---

## Database Schema

The database schema is defined in `server/prisma/schema.prisma`:

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

Current models:
- `sleep_records` - Sleep session tracking
- `vitals` - Heart rate, HRV, breathing rate (5-minute intervals)
- `water_level_readings` - Water level sensor data
- `leak_alerts` - Leak detection alerts

---

## Best Practices

1. ✅ **Always use the migration wrapper** (`migrate.sh`) on the pod
2. ✅ **Use descriptive migration names** (e.g., `add_user_preferences` not `update1`)
3. ✅ **Test migrations locally first** before running on the pod
4. ✅ **Back up your database** before major schema changes
5. ✅ **Check database lock status** before manual operations
6. ❌ **Never run migrations while services are active** (unless using the wrapper)
7. ❌ **Never force-kill database connections** without proper service shutdown

---

## Getting Help

If you encounter issues:

1. Run the diagnostic tool: `bash scripts/check_db_lock.sh`
2. Check service logs: `journalctl -u free-sleep --no-pager --output=cat -n 100`
3. Join the Discord: https://discord.gg/JpArXnBgEj
4. Create an issue on GitHub with:
   - Error message
   - Output of diagnostic tool
   - Service logs
   - Steps to reproduce

---

## Technical Details

### SQLite WAL Mode

Free Sleep uses SQLite in WAL (Write-Ahead Logging) mode, which allows:
- Better concurrency (one writer, multiple readers)
- Improved performance
- Crash safety

WAL creates two additional files:
- `free-sleep.db-wal` - Write-ahead log
- `free-sleep.db-shm` - Shared memory

These files indicate active database connections.

### Service Dependencies

The `free-sleep` service runs:
- Express API server (port 3000)
- Background jobs (scheduling, biometrics)
- WebSocket connections (if enabled)

The `free-sleep-stream` service runs:
- Biometrics data streaming
- Real-time vitals processing

Both services maintain persistent database connections, which must be closed before migrations.

---

## Related Files

- `scripts/migrate.sh` - Main migration wrapper
- `scripts/check_db_lock.sh` - Diagnostic tool
- `scripts/install.sh` - Installation script (includes migration)
- `server/prisma/schema.prisma` - Database schema
- `server/package.json` - NPM scripts configuration
