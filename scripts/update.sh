#!/bin/bash

# Optional: Exit immediately on error
set -e

# Name of the backup folder with a timestamp
print_json_if_exists() {
  local file_path="$1"
  local label="$2"

  if [ -f "$file_path" ]; then
    python3 -m json.tool "$file_path" \
      | sed 's/^/      /' \
      | sed $'s/^/\033[0;90m/' \
      | sed $'s/$/\033[0m/'
  else
    echo "File not found: $file_path ❌"
  fi
}
print_json_if_exists "/home/dac/free-sleep/server/src/serverInfo.json" "Server info"

BACKUP_PATH="/home/dac/free-sleep-backup"
APP_DIR="/home/dac/free-sleep"

# Keep biometrics stopped through the downloaded installer, including older installers.
services_to_restore=""
restore_services() {
  for service_name in $services_to_restore; do
    systemctl start "$service_name" || true
  done
}
trap restore_services EXIT
for service_name in free-sleep-environment free-sleep-stream free-sleep; do
  if systemctl is-active --quiet "$service_name"; then
    services_to_restore="$service_name $services_to_restore"
    systemctl stop "$service_name"
  fi
done

if [ -f /persistent/free-sleep-data/free-sleep.db ]; then
  python3 "$APP_DIR/scripts/sqlite_maintenance.py" backup \
    /persistent/free-sleep-data/free-sleep.db \
    /persistent/free-sleep-data/free-sleep-copy.db --checkpoint
fi

# Snapshot the current build for scripts/autopilot_rollback.sh --full (never blocks the update).
if [ -f "$APP_DIR/scripts/autopilot_snapshot.sh" ]; then
  sh "$APP_DIR/scripts/autopilot_snapshot.sh" || echo "WARNING: autopilot snapshot failed; continuing update."
fi

systemctl disable free-sleep

# Unblock internet first
sh /home/dac/free-sleep/scripts/unblock_internet_access.sh

# If a free-sleep folder exists, back it up
if [ -d /home/dac/free-sleep ]; then
  echo "Backing up current free-sleep to $BACKUP_PATH"
  mv /home/dac/free-sleep $BACKUP_PATH
fi

echo "Attempting to reinstall free-sleep..."
update_succeeded=false
# Check the download separately: running an empty script after a failed curl exits successfully.
if installer_source=$(curl -fsSL https://raw.githubusercontent.com/throwaway31265/free-sleep/main/scripts/install.sh) \
  && [ -n "$installer_source" ] \
  && /bin/bash -c "$installer_source" \
  && [ -d "$APP_DIR" ]; then
  echo "Reinstall successful."
  update_succeeded=true
  rm -rf "$BACKUP_PATH"
else
  echo "Reinstall failed. Restoring from backup..."
  rm -rf /home/dac/free-sleep
  mv "$BACKUP_PATH" /home/dac/free-sleep
fi

# A checkout without the environment reader (e.g. upstream main) leaves its unit pointing at a
# missing file; retire the unit instead of letting the EXIT trap restart it forever.
if [ ! -f "$APP_DIR/biometrics/environment/environment_reader.py" ] \
  && [ -f /etc/systemd/system/free-sleep-environment.service ]; then
  echo "Installed build has no environment reader; removing free-sleep-environment.service"
  systemctl disable --now free-sleep-environment || true
  rm -f /etc/systemd/system/free-sleep-environment.service
  systemctl daemon-reload || true
  systemctl reset-failed free-sleep-environment 2>/dev/null || true
  services_to_restore=$(echo "$services_to_restore" | sed 's/free-sleep-environment//')
fi

systemctl enable free-sleep || true
systemctl start free-sleep || true

# The downloaded installer may predate the environment reader, so (re)create its unit here too.
# Skipped when the installed (or restored) checkout does not ship the script.
if [ -f "$APP_DIR/scripts/setup_environment_service.sh" ]; then
  bash "$APP_DIR/scripts/setup_environment_service.sh" \
    || echo "WARNING: Unable to set up free-sleep-environment.service" >&2
fi

# Block internet access again
sh /home/dac/free-sleep/scripts/block_internet_access.sh
if [ "$update_succeeded" != true ]; then
  echo "Update failed; the previous installation was restored." >&2
  exit 1
fi
echo -e "\033[0;32mUpdate completed successfully!\033[0m"
echo -e "\033[0;32mRestart your pod with 'reboot -h now'\033[0m"
