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

# Function to stop services
stop_services() {
  echo -e "${YELLOW}Stopping Free Sleep services to release database locks...${NC}"

  local services=("free-sleep" "free-sleep-stream")

  for service in "${services[@]}"; do
    if systemctl list-units --full --all 2>/dev/null | grep -q "${service}\.service"; then
      if systemctl is-active "$service" >/dev/null 2>&1; then
        echo "Stopping $service service..."
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
        echo "$service is not running"
      fi
    fi
  done

  # Extra wait to ensure all database connections are released
  echo "Waiting for database locks to clear..."
  sleep 2
  echo ""
}

# Function to start services
start_services() {
  echo ""
  echo -e "${YELLOW}Starting Free Sleep services...${NC}"

  local services=("free-sleep" "free-sleep-stream")

  for service in "${services[@]}"; do
    if systemctl list-units --full --all 2>/dev/null | grep -q "${service}\.service"; then
      echo "Starting $service service..."
      sudo systemctl start "$service" || echo -e "${YELLOW}Warning: Failed to start $service${NC}"

      # Give it a moment to start
      sleep 1

      if systemctl is-active "$service" >/dev/null 2>&1; then
        echo -e "${GREEN}✓ $service started${NC}"
      else
        echo -e "${YELLOW}⚠ $service may not have started correctly${NC}"
      fi
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
SERVICES_WERE_STOPPED=false

# Determine environment and handle accordingly
if [ "$ENVIRONMENT" = "local" ]; then
  echo -e "${GREEN}Running in local development mode${NC}"
  echo "Services will not be stopped"
  echo ""

  run_migration ".env.local"

elif is_pod_environment; then
  echo -e "${GREEN}Detected pod environment with systemd services${NC}"
  echo ""

  # Stop services before migration
  stop_services
  SERVICES_WERE_STOPPED=true

  # Run migration
  if run_migration ".env.pod"; then
    # Migration succeeded, restart services
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
  run_migration ".env.pod"
fi

echo ""
echo "==================================================================="
echo -e "${GREEN}Migration process complete!${NC}"
echo "==================================================================="

# Show service status if we stopped them
if [ "$SERVICES_WERE_STOPPED" = true ]; then
  echo ""
  echo "Current service status:"
  systemctl status free-sleep --no-pager --lines=0 || true
fi

exit 0
