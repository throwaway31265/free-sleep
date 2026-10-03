#!/bin/bash
set -euo pipefail

echo "=== $(date '+%Y-%m-%d %H:%M:%S') Starting update.sh ==="
echo "Sleeping for 3 seconds..."
sleep 3

export PATH="/usr/sbin:/sbin:/usr/bin:/bin"

# This wrapper also runs from /persistent so older downloaded installers cannot remove its protection.
MAINTENANCE_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
services_to_restore=""
restore_services() {
  for service_name in $services_to_restore; do
    systemctl start "$service_name" || true
  done
}
trap restore_services EXIT
for service_name in free-sleep-stream free-sleep; do
  if systemctl is-active --quiet "$service_name"; then
    services_to_restore="$service_name $services_to_restore"
    systemctl stop "$service_name"
  fi
done

if [ -f /persistent/free-sleep-data/free-sleep.db ]; then
  python3 "$MAINTENANCE_SCRIPT_DIR/sqlite_maintenance.py" backup \
    /persistent/free-sleep-data/free-sleep.db \
    /persistent/free-sleep-data/free-sleep-copy.db --checkpoint
fi

sh /home/dac/free-sleep/scripts/update.sh
