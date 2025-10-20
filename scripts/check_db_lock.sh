#!/bin/bash
# Free Sleep Database Lock Diagnostic Tool
#
# This script checks for SQLite database locks and provides diagnostic information
# to help troubleshoot migration issues.
#
# Usage:
#   ./check_db_lock.sh

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "==================================================================="
echo "           Free Sleep Database Lock Diagnostic"
echo "==================================================================="
echo ""

# Database file location
DB_PATH="/persistent/free-sleep-data/free-sleep.db"

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
  echo -e "${RED}✗ Database file not found: $DB_PATH${NC}"
  echo ""
  echo "This is normal for local development environments."
  exit 0
fi

echo -e "${GREEN}✓ Database file found: $DB_PATH${NC}"
echo ""

# Check for WAL files (indicates active connections)
echo -e "${BLUE}Checking for active database connections...${NC}"
if [ -f "${DB_PATH}-wal" ] || [ -f "${DB_PATH}-shm" ]; then
  echo -e "${YELLOW}⚠ WAL files detected - database has active connections${NC}"

  if [ -f "${DB_PATH}-wal" ]; then
    WAL_SIZE=$(stat -f%z "${DB_PATH}-wal" 2>/dev/null || stat -c%s "${DB_PATH}-wal" 2>/dev/null || echo "unknown")
    echo "  - WAL file: ${DB_PATH}-wal (size: $WAL_SIZE bytes)"
  fi

  if [ -f "${DB_PATH}-shm" ]; then
    SHM_SIZE=$(stat -f%z "${DB_PATH}-shm" 2>/dev/null || stat -c%s "${DB_PATH}-shm" 2>/dev/null || echo "unknown")
    echo "  - SHM file: ${DB_PATH}-shm (size: $SHM_SIZE bytes)"
  fi
else
  echo -e "${GREEN}✓ No WAL files found - database appears to be idle${NC}"
fi
echo ""

# Check for processes using the database
echo -e "${BLUE}Checking for processes accessing the database...${NC}"
if command -v lsof >/dev/null 2>&1; then
  DB_PROCESSES=$(lsof "$DB_PATH" 2>/dev/null || true)

  if [ -n "$DB_PROCESSES" ]; then
    echo -e "${YELLOW}⚠ Processes with open database connections:${NC}"
    echo "$DB_PROCESSES"
  else
    echo -e "${GREEN}✓ No processes currently accessing the database${NC}"
  fi
else
  echo -e "${YELLOW}⚠ 'lsof' command not available, cannot check for open file handles${NC}"
fi
echo ""

# Check service status
echo -e "${BLUE}Checking Free Sleep service status...${NC}"
if command -v systemctl >/dev/null 2>&1; then
  for service in free-sleep free-sleep-stream; do
    if systemctl list-units --full --all 2>/dev/null | grep -q "${service}\.service"; then
      if systemctl is-active "$service" >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠ $service.service is RUNNING${NC}"
        echo "  PID: $(systemctl show -p MainPID --value $service)"
      else
        echo -e "${GREEN}✓ $service.service is STOPPED${NC}"
      fi
    else
      echo "  $service.service not found"
    fi
  done
else
  echo -e "${YELLOW}⚠ systemctl not available, cannot check service status${NC}"
fi
echo ""

# Check for bun/node processes
echo -e "${BLUE}Checking for Bun/Node processes...${NC}"
BUN_PROCESSES=$(ps aux | grep -E '[b]un.*server|[n]ode.*server|[b]un.*prisma' | grep -v grep || true)

if [ -n "$BUN_PROCESSES" ]; then
  echo -e "${YELLOW}⚠ Found Bun/Node processes:${NC}"
  echo "$BUN_PROCESSES"
else
  echo -e "${GREEN}✓ No Bun/Node server processes found${NC}"
fi
echo ""

# Provide recommendations
echo "==================================================================="
echo "                        Recommendations"
echo "==================================================================="
echo ""

if [ -f "${DB_PATH}-wal" ] || [ -f "${DB_PATH}-shm" ]; then
  echo -e "${YELLOW}Database appears to have active connections.${NC}"
  echo ""
  echo "To run migrations safely:"
  echo ""
  echo "  1. Use the migration wrapper script:"
  echo -e "     ${GREEN}./scripts/migrate.sh <migration_name>${NC}"
  echo ""
  echo "  2. Or manually stop services before migration:"
  echo -e "     ${GREEN}sudo systemctl stop free-sleep free-sleep-stream${NC}"
  echo -e "     ${GREEN}bun run migrate <migration_name>${NC}"
  echo -e "     ${GREEN}sudo systemctl start free-sleep free-sleep-stream${NC}"
else
  echo -e "${GREEN}Database appears to be idle. You should be able to run migrations.${NC}"
  echo ""
  echo "To run migrations:"
  echo -e "  ${GREEN}./scripts/migrate.sh <migration_name>${NC}"
fi

echo ""
echo "==================================================================="
