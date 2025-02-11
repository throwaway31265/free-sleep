#!/bin/bash

# Optional: Exit immediately on error
set -e

# Name of the backup folder with a timestamp
BACKUP_NAME="free-sleep-backup-$(date +%Y%m%d%H%M%S)"

systemctl stop free-sleep
systemctl disable free-sleep

# Unblock internet first
sh /home/dac/free-sleep/scripts/unblock_internet_access.sh

# If a free-sleep folder exists, back it up
if [ -d /home/dac/free-sleep ]; then
  echo "Backing up current free-sleep to /home/dac/$BACKUP_NAME"
  mv /home/dac/free-sleep /home/dac/$BACKUP_NAME
fi

echo "Attempting to reinstall free-sleep..."
if /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/nikita/free-sleep/main/scripts/install.sh)"; then
  echo "Reinstall successful."
   rm -rf "/home/dac/$BACKUP_NAME"
else
  echo "Reinstall failed. Restoring from backup..."
  rm -rf /home/dac/free-sleep
  mv "/home/dac/$BACKUP_NAME" /home/dac/free-sleep
  systemctl enable free-sleep
  systemctl start free-sleep
fi

# Block internet access again
sh /home/dac/free-sleep/scripts/block_internet_access.sh
echo -e "\033[0;32mUpdate completed successfully!\033[0m"