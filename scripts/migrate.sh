#!/bin/bash
# Free Sleep Database Migration Wrapper
#
# This script safely handles Prisma migrations by managing service state
# to prevent SQLite database lock issues.
#
# Usage:
#   ./migrate.sh <migration_name>     # Run on pod
#   ./migrate.sh <migration_name> local # Run locally
#
# Exit immediately on error
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get migration name from first argument
MIGRATION_NAME="${1:-}"
ENVIRONMENT="${2:-pod}"

# Determine the server directory (script is in scripts/, server is in ../server)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR/../server" && pwd)"

# Array to track which services were actually stopped
declare -a STOPPED_SERVICES=()

echo "==================================================================="
echo "           Free Sleep Database Migration"
echo "==================================================================="
echo ""

# Validate migration name
if [ -z "$MIGRATION_NAME" ]; then
  echo -e "${RED}ERROR: Migration name is required${NC}"
  echo ""
  echo "Usage:"
  echo "  ./migrate.sh <migration_name>       # Run on pod"
  echo "  ./migrate.sh <migration_name> local # Run locally"
  echo ""
  echo "Example:"
  echo "  ./migrate.sh add_user_table"
  exit 1
fi

echo "Migration name: $MIGRATION_NAME"
echo "Environment: $ENVIRONMENT"
echo ""

# Function to check if we're on a pod with systemd services
is_pod_environment() {
  if ! command -v systemctl >/dev/null 2>&1; then
    return 1
  fi

  if systemctl list-units --type=service 2>/dev/null | grep -q "free-sleep.service"; then
    return 0
  fi

  return 1
}

# Function to stop services and track which ones were stopped
stop_services() {
  echo -e "${YELLOW}Stopping Free Sleep services to release database locks...${NC}"

  local services=("free-sleep" "free-sleep-stream")

  for service in "${services[@]}"; do
    if systemctl list-units --full --all 2>/dev/null | grep -q "${service}\.service"; then
      if systemctl is-active "$service" >/dev/null 2>&1; then
        echo "Stopping $service service..."

        # Track that this service was running
        STOPPED_SERVICES+=("$service")

        sudo systemctl stop "$service" || true

        # Wait for service to fully stop
        local timeout=10
        while [ $timeout -gt 0 ] && systemctl is-active "$service" >/dev/null 2>&1; do
          sleep 1
          timeout=$((timeout - 1))
        done

        if systemctl is-active "$service" >/dev/null 2>&1; then
          echo -e "${YELLOW}WARNING: $service did not stop cleanly, forcing stop...${NC}"
          sudo systemctl kill "$service" || true
          sleep 2
        fi

        echo -e "${GREEN}✓ $service stopped${NC}"
      else
        echo "$service is not running (will not be restarted)"
      fi
    else
      echo "$service.service does not exist"
    fi
  done

  # Extra wait to ensure all database connections are released
  echo "Waiting for database locks to clear..."
  sleep 2
  echo ""
}

# Function to start only the services that were stopped
start_services() {
  echo ""

  if [ ${#STOPPED_SERVICES[@]} -eq 0 ]; then
    echo -e "${GREEN}No services need to be restarted${NC}"
    return 0
  fi

  echo -e "${YELLOW}Starting Free Sleep services that were stopped...${NC}"

  for service in "${STOPPED_SERVICES[@]}"; do
    echo "Starting $service service..."
    sudo systemctl start "$service" || echo -e "${YELLOW}Warning: Failed to start $service${NC}"

    # Give it a moment to start
    sleep 1

    if systemctl is-active "$service" >/dev/null 2>&1; then
      echo -e "${GREEN}✓ $service started${NC}"
    else
      echo -e "${YELLOW}⚠ $service may not have started correctly${NC}"
    fi
  done
}

# Function to run migration
run_migration() {
  local env_file="$1"

  echo -e "${YELLOW}Running Prisma migration...${NC}"
  echo "Using environment file: $env_file"
  echo ""

  cd "$SERVER_DIR"

  # Check if migration files exist but are out of sync
  if [ -d "prisma/migrations" ]; then
    echo -e "${YELLOW}Checking migration status...${NC}"

    # Try to get migration status (this might fail if out of sync)
    if ! bun run dotenv -e "$env_file" -- bun x prisma migrate status 2>&1 | tee /tmp/migrate_status.txt; then
      if grep -q "missing from the local migrations directory" /tmp/migrate_status.txt; then
        echo ""
        echo -e "${RED}ERROR: Local migrations are out of sync with database${NC}"
        echo ""
        echo "This usually happens when:"
        echo "  1. Working on a different branch with different migrations"
        echo "  2. Database was migrated separately from code"
        echo "  3. Migration files were deleted locally"
        echo ""
        echo "Solutions:"
        echo ""
        echo "  1. Pull latest code to get missing migration files:"
        echo -e "     ${GREEN}git pull origin main${NC}"
        echo ""
        echo "  2. If you're sure local migrations are correct, reset database (⚠️ DESTROYS DATA):"
        echo -e "     ${GREEN}bun run migrate:reset${NC}"
        echo ""
        echo "  3. Manually sync migrations from database:"
        echo -e "     ${GREEN}bun x prisma migrate resolve --applied <migration_name>${NC}"
        echo ""
        return 1
      fi
    fi
    echo ""
  fi

  # Run the migration with the appropriate env file
  if bun run dotenv -e "$env_file" -- bun x prisma migrate dev --name "$MIGRATION_NAME"; then
    echo ""
    echo -e "${GREEN}✓ Migration completed successfully!${NC}"
    return 0
  else
    echo ""
    echo -e "${RED}✗ Migration failed!${NC}"
    return 1
  fi
}

# Main logic
MIGRATION_SUCCEEDED=false

# Determine environment and handle accordingly
if [ "$ENVIRONMENT" = "local" ]; then
  echo -e "${GREEN}Running in local development mode${NC}"
  echo "Services will not be stopped"
  echo ""

  if run_migration ".env.local"; then
    MIGRATION_SUCCEEDED=true
  fi

elif is_pod_environment; then
  echo -e "${GREEN}Detected pod environment with systemd services${NC}"
  echo ""

  # Stop services before migration
  stop_services

  # Run migration
  if run_migration ".env.pod"; then
    MIGRATION_SUCCEEDED=true
    # Migration succeeded, restart services that were stopped
    start_services
  else
    # Migration failed, still try to restart services
    echo ""
    echo -e "${RED}Migration failed, but attempting to restart services...${NC}"
    start_services
    exit 1
  fi

else
  echo -e "${GREEN}Running in development mode (no systemd services detected)${NC}"
  echo ""

  # Assume local environment
  if run_migration ".env.pod"; then
    MIGRATION_SUCCEEDED=true
  fi
fi

echo ""
echo "==================================================================="
if [ "$MIGRATION_SUCCEEDED" = true ]; then
  echo -e "${GREEN}Migration completed successfully!${NC}"
else
  echo -e "${RED}Migration failed. Check the error messages above.${NC}"
fi
echo "==================================================================="

# Show service status if we stopped them
if [ ${#STOPPED_SERVICES[@]} -gt 0 ]; then
  echo ""
  echo "Service status:"
  for service in "${STOPPED_SERVICES[@]}"; do
    systemctl status "$service" --no-pager --lines=0 || true
  done
fi

# Exit with appropriate code
if [ "$MIGRATION_SUCCEEDED" = true ]; then
  exit 0
else
  exit 1
fi
