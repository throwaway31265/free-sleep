#!/bin/bash
# Free Sleep Migration Sync Helper
#
# This script helps resolve migration sync issues where migrations exist in the database
# but are missing from the local migrations directory.
#
# Usage:
#   ./sync_migrations.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Determine the server directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR/../server" && pwd)"

echo "==================================================================="
echo "           Free Sleep Migration Sync Helper"
echo "==================================================================="
echo ""

cd "$SERVER_DIR"

# Check migration status
echo -e "${BLUE}Checking migration status...${NC}"
echo ""

if bun run dotenv -e .env.pod -- bun x prisma migrate status 2>&1 | tee /tmp/migrate_status_full.txt; then
  echo ""
  echo -e "${GREEN}✓ Migrations are in sync${NC}"
  exit 0
fi

# Check if it's a sync issue
if ! grep -q "missing from the local migrations directory" /tmp/migrate_status_full.txt; then
  echo ""
  echo -e "${RED}Migration status check failed, but not due to missing local migrations${NC}"
  echo "Check the output above for details"
  exit 1
fi

# Extract the missing migration names
echo ""
echo -e "${YELLOW}Found migrations in database that are missing locally:${NC}"
MISSING_MIGRATIONS=$(grep -A 1000 "missing from the local migrations directory" /tmp/migrate_status_full.txt | grep "^[0-9]" | awk '{print $1}' || true)

if [ -z "$MISSING_MIGRATIONS" ]; then
  echo -e "${RED}Could not parse missing migrations${NC}"
  exit 1
fi

echo "$MISSING_MIGRATIONS" | while read -r migration; do
  echo "  - $migration"
done

echo ""
echo -e "${YELLOW}What would you like to do?${NC}"
echo ""
echo "1. Pull latest code to get the missing migration files (RECOMMENDED)"
echo "   This will update your code to match what's in the database"
echo ""
echo "2. Mark migrations as already applied (for advanced users)"
echo "   Use this if you're sure the database is correct and local code is up to date"
echo ""
echo "3. Cancel"
echo ""
read -p "Enter your choice (1/2/3): " choice

case $choice in
  1)
    echo ""
    echo -e "${GREEN}Pulling latest code...${NC}"
    cd "$SCRIPT_DIR/.."

    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
      echo -e "${RED}ERROR: Not in a git repository${NC}"
      echo "You'll need to manually update your code to get the missing migration files"
      exit 1
    fi

    # Store current branch
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    echo "Current branch: $CURRENT_BRANCH"

    # Pull latest changes
    if git pull origin "$CURRENT_BRANCH"; then
      echo ""
      echo -e "${GREEN}✓ Code updated successfully${NC}"
      echo ""
      echo "Checking migration status again..."
      cd "$SERVER_DIR"

      if bun run dotenv -e .env.pod -- bun x prisma migrate status; then
        echo ""
        echo -e "${GREEN}✓ Migrations are now in sync!${NC}"
      else
        echo ""
        echo -e "${YELLOW}⚠ Migrations may still be out of sync. Check the output above.${NC}"
      fi
    else
      echo ""
      echo -e "${RED}✗ Failed to pull latest code${NC}"
      echo "You may have local changes that conflict. Resolve them and try again."
      exit 1
    fi
    ;;

  2)
    echo ""
    echo -e "${RED}⚠ WARNING: This will mark migrations as applied without running them${NC}"
    echo "Only do this if you're CERTAIN the database already has these changes"
    echo ""
    read -p "Are you sure? (yes/no): " confirm

    if [ "$confirm" != "yes" ]; then
      echo "Cancelled"
      exit 0
    fi

    # Mark each migration as applied
    echo ""
    echo "Marking migrations as applied..."
    echo "$MISSING_MIGRATIONS" | while read -r migration; do
      echo "  Processing: $migration"
      if bun run dotenv -e .env.pod -- bun x prisma migrate resolve --applied "$migration"; then
        echo -e "  ${GREEN}✓ Marked as applied${NC}"
      else
        echo -e "  ${RED}✗ Failed to mark as applied${NC}"
      fi
    done

    echo ""
    echo "Checking migration status..."
    if bun run dotenv -e .env.pod -- bun x prisma migrate status; then
      echo ""
      echo -e "${GREEN}✓ Migrations are now in sync!${NC}"
    else
      echo ""
      echo -e "${YELLOW}⚠ There may still be sync issues. Check the output above.${NC}"
    fi
    ;;

  3)
    echo "Cancelled"
    exit 0
    ;;

  *)
    echo -e "${RED}Invalid choice${NC}"
    exit 1
    ;;
esac

echo ""
echo "==================================================================="
echo -e "${GREEN}Done!${NC}"
echo "==================================================================="
