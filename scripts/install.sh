#!/bin/bash
# Exit immediately on error, on undefined variables, and on error in pipelines
set -euo pipefail

# --------------------------------------------------------------------------------
# Variables
REPO_URL="https://github.com/throwaway31265/free-sleep/archive/refs/heads/main.zip"
ZIP_FILE="free-sleep.zip"
REPO_DIR="/home/dac/free-sleep"
SERVER_DIR="$REPO_DIR/server"
USERNAME="dac"

# --------------------------------------------------------------------------------
# Download the repository
echo "Downloading the repository..."
curl -L -o "$ZIP_FILE" "$REPO_URL"

echo ""
echo "Unzipping the repository..."
unzip -o -q "$ZIP_FILE"
echo "Removing the zip file..."
rm -f "$ZIP_FILE"

# Clean up existing directory and move new code into place
echo "Setting up the installation directory..."
rm -rf "$REPO_DIR"
mv free-sleep-main "$REPO_DIR"


chown -R "$USERNAME":"$USERNAME" "$REPO_DIR"

# --------------------------------------------------------------------------------
# Install or update Volta
# - We check once. If it’s not installed, install it.
echo "Checking if Volta is installed for user '$USERNAME'..."
if [ -d "/home/$USERNAME/.volta" ]; then
  echo "Volta is already installed for user '$USERNAME'."
else
  echo "Volta is not installed. Installing for user '$USERNAME'..."
  sudo -u "$USERNAME" bash -c 'curl https://get.volta.sh | bash'
  # Ensure Volta environment variables are in the DAC user’s profile:
  if ! grep -q 'export VOLTA_HOME=' "/home/$USERNAME/.profile"; then
    echo -e '\nexport VOLTA_HOME="/home/dac/.volta"\nexport PATH="$VOLTA_HOME/bin:$PATH"\n' \
      >> "/home/$USERNAME/.profile"
  fi
  echo "Finished installing Volta"
  echo ""
fi


# --------------------------------------------------------------------------------
# Install (or update) Node via Volta
echo "Installing/ensuring Node 24.11.0 via Volta..."
sudo -u "$USERNAME" bash -c "source /home/$USERNAME/.profile && volta install node@24.11.0"

# --------------------------------------------------------------------------------
# Setup /persistent/free-sleep-data (migrate old configs, logs, etc.)
mkdir -p /persistent/free-sleep-data/logs/
mkdir -p /persistent/free-sleep-data/lowdb/

SRC_FILE="/opt/eight/bin/frank.sh"
DEST_FILE="/persistent/free-sleep-data/dac_sock_path.txt"

if [ -f "$DEST_FILE" ]; then
  echo "Destination file $DEST_FILE already exists, skipping copy."
else
  if [ -r "$SRC_FILE" ]; then
    echo "Found $SRC_FILE, searching for dac.sock path..."
    result=$(grep -oP '(?<=DAC_SOCKET=)[^ ]*dac\.sock' "$SRC_FILE" || true)
    if [ -n "$result" ]; then
      echo "$result" > "$DEST_FILE"
      echo "DAC socket path saved to $DEST_FILE"
    else
      echo "No dac.sock path found in $SRC_FILE, skipping write."
    fi
  else
    echo "File $SRC_FILE not found or not readable, skipping."
  fi
fi


# DO NOT REMOVE, OLD VERSIONS WILL LOSE settings & schedules
FILES_TO_MOVE=(
  "/home/dac/free-sleep-database/settingsDB.json:/persistent/free-sleep-data/lowdb/settingsDB.json"
  "/home/dac/free-sleep-database/schedulesDB.json:/persistent/free-sleep-data/lowdb/schedulesDB.json"
  "/home/dac/dac_sock_path.txt:/persistent/free-sleep-data/dac_sock_path.txt"
)

for entry in "${FILES_TO_MOVE[@]}"; do
  IFS=":" read -r SOURCE_FILE DESTINATION <<< "$entry"
  if [ -f "$SOURCE_FILE" ]; then
    mv "$SOURCE_FILE" "$DESTINATION"
    echo "Moved $SOURCE_FILE to $DESTINATION"
  fi
done

if [ -d /persistent/deviceinfo/ ]; then
  chown -R "$USERNAME":"$USERNAME" /persistent/deviceinfo/
fi

if [ -d /deviceinfo/ ]; then
  chown -R "$USERNAME":"$USERNAME" /deviceinfo/
fi

# Change ownership and permissions
chown -R "$USERNAME":"$USERNAME" /persistent/free-sleep-data/
chmod 770 /persistent/free-sleep-data/
chmod g+s /persistent/free-sleep-data/

# --------------------------------------------------------------------------------
# Install server dependencies

BACKUP_PATH="/home/dac/free-sleep-backup/server/package-lock.json"
NEW_PATH="/home/dac/free-sleep/server/package-lock.json"
NODE_MODULES_BACKUP="/home/dac/free-sleep-backup/server/node_modules"
NODE_MODULES_NEW="/home/dac/free-sleep/server/node_modules"

echo "Reviewing npm dependencies for changes..."
if [ -f "$BACKUP_PATH" ] && [ -f "$NEW_PATH" ]; then
  BACKUP_HASH=$(sha256sum "$BACKUP_PATH" | awk '{print $1}')
  NEW_HASH=$(sha256sum "$NEW_PATH" | awk '{print $1}')

  echo "Backup hash: $BACKUP_HASH"
  echo "New hash: $NEW_HASH"

  if [ "$BACKUP_HASH" != "$NEW_HASH" ]; then
    echo "package-lock.json changed — running npm install..."
    sudo -u "$USERNAME" bash -c "cd '$SERVER_DIR' && /home/$USERNAME/.volta/bin/npm install"
  else
    echo "package-lock.json unchanged — restoring node_modules from backup..."
    if [ -d "$NODE_MODULES_BACKUP" ]; then
      mv "$NODE_MODULES_BACKUP" "$NODE_MODULES_NEW"
      chown -R "$USERNAME:$USERNAME" "$NODE_MODULES_NEW" || true
      echo "node_modules restored from backup."
    else
      echo "Backup node_modules not found, running npm install instead..."
      sudo -u "$USERNAME" bash -c "cd '$SERVER_DIR' && /home/$USERNAME/.volta/bin/npm install"
    fi
  fi
else
  echo "One or both package-lock.json files missing, running npm install..."
  sudo -u "$USERNAME" bash -c "cd '$SERVER_DIR' && /home/$USERNAME/.volta/bin/npm install"
fi
echo ""

# --------------------------------------------------------------------------------
# Run Prisma migrations


# Stop the free-sleep-stream service if it was running
# This is needed to close out the lock files for the SQLite file
biometrics_enabled="false"
if systemctl is-active --quiet free-sleep-stream && systemctl list-unit-files | grep -q "^free-sleep-stream.service"; then
  biometrics_enabled="true"
  echo "Stopping biometrics service..."
  systemctl stop free-sleep-stream
  sleep 5
fi

SRC="/persistent/free-sleep-data/free-sleep.db"
DEST="/persistent/free-sleep-data/free-sleep-copy.db"

if [ -f "$SRC" ]; then
  cp "$SRC" "$DEST"
  echo "Making a backup up database prior to migrations"
  echo "Database copied to $DEST"
else
  echo "Source database not found, skipping copying database."
fi




rm -f /persistent/free-sleep-data/free-sleep.db-shm \
      /persistent/free-sleep-data/free-sleep.db-wal \
      /persistent/free-sleep-data/free-sleep.db-journal

migration_failed="false"

echo "Running Prisma migrations..."
if sudo -u "$USERNAME" bash -c "cd '$SERVER_DIR' && /home/$USERNAME/.volta/bin/npm run migrate deploy"; then
  echo "Prisma migrations completed successfully."
else
  migration_failed="true"
  echo -e "\033[33mWARNING: Prisma migrations failed! \033[0m"
fi


# Restart free-sleep-stream if it was running before
if [ "$biometrics_enabled" = "true" ]; then
  echo "Restarting free-sleep-stream service..."
  systemctl restart free-sleep-stream
fi

echo ""

# --------------------------------------------------------------------------------
# Create systemd service

SERVICE_FILE="/etc/systemd/system/free-sleep.service"

echo "Creating systemd service file at $SERVICE_FILE..."

cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Free Sleep Server
After=network.target

[Service]
ExecStart=/home/$USERNAME/.volta/bin/npm run start
WorkingDirectory=$SERVER_DIR
Restart=always
User=$USERNAME
Environment=NODE_ENV=production
Environment=VOLTA_HOME=/home/$USERNAME/.volta
Environment=PATH=/home/$USERNAME/.volta/bin:/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin

[Install]
WantedBy=multi-user.target
EOF

echo "Reloading systemd daemon and enabling the service..."
systemctl daemon-reload
systemctl enable free-sleep.service

echo "Starting free-sleep.service..."
systemctl start free-sleep.service

echo "Checking free-sleep service status..."
systemctl status free-sleep.service --no-pager || true
echo ""

# -----------------------------------------------------------------------------------------------------
# Create systemd service for updating

UPDATE_SERVICE_FILE="/etc/systemd/system/free-sleep-update.service"
echo "Creating systemd service file at $UPDATE_SERVICE_FILE..."

cat > "$UPDATE_SERVICE_FILE" <<EOF
[Unit]
Description=Free Sleep Updater
After=free-sleep.service

[Service]
Type=oneshot
ExecStart=/home/dac/free-sleep/scripts/update_service.sh
User=root
Group=root
KillMode=process
# Also capture logs at the unit level (append so your file grows)
StandardOutput=append:/persistent/free-sleep-data/logs/free-sleep-update.log
StandardError=append:/persistent/free-sleep-data/logs/free-sleep-update.log

EOF
# --------------------------------------------------------------------------------
# Graceful device time update (optional)

echo "Attempting to update device time from Google..."
# If the curl fails or is blocked, skip with a warning but don't fail the entire script
if date_string="$(curl -s --head http://google.com | grep '^Date: ' | sed 's/Date: //g')" && [ -n "$date_string" ]; then
  date -s "$date_string" || echo "WARNING: Unable to update system time"
else
  echo -e "\033[0;33mWARNING: Unable to retrieve date from Google... Skipping time update.\033[0m"
fi

echo ""
# --------------------------------------------------------------------------------
# Setup passwordless sudo scripts for dac user

SUDOERS_FILE="/etc/sudoers.d/$USERNAME"
echo "Setting up sudoers rules..."
# Reboot
SUDOERS_RULE="$USERNAME ALL=(ALL) NOPASSWD: /sbin/reboot"
if sudo grep -Fxq "$SUDOERS_RULE" "$SUDOERS_FILE" 2>/dev/null; then
  echo "Rule for '$USERNAME' reboot permissions already exists."
else
  echo "$SUDOERS_RULE" | sudo tee "$SUDOERS_FILE" > /dev/null
  sudo chmod 440 "$SUDOERS_FILE"
  echo "Passwordless permission for reboots granted to '$USERNAME'."
fi

# Updates
SUDOERS_UPDATE_RULE="$USERNAME ALL=(root) NOPASSWD: /bin/systemctl start free-sleep-update.service --no-block"
if sudo grep -Fxq "$SUDOERS_UPDATE_RULE" "$SUDOERS_FILE" 2>/dev/null; then
  echo "Rule for '$USERNAME' update permissions already exists."
else
  echo "$SUDOERS_UPDATE_RULE" | sudo tee -a "$SUDOERS_FILE" >> /dev/null
  sudo chmod 440 "$SUDOERS_FILE"
  echo "Passwordless permission for updates granted to '$USERNAME'."
fi
chmod 755 /home/dac/free-sleep/scripts/update_service.sh


# Biometrics enablement
SUDOERS_BIOMETRICS_RULE="$USERNAME ALL=(ALL) NOPASSWD: /bin/sh /home/dac/free-sleep/scripts/enable_biometrics.sh"
if sudo grep -Fxq "$SUDOERS_BIOMETRICS_RULE" "$SUDOERS_FILE" 2>/dev/null; then
  echo "Rule for '$USERNAME' biometrics permissions already exists."
else
  echo "$SUDOERS_BIOMETRICS_RULE" | sudo tee -a "$SUDOERS_FILE" >> /dev/null
  sudo chmod 440 "$SUDOERS_FILE"
  echo "Passwordless permission for biometrics granted to '$USERNAME'."
fi

echo ""

sh /home/dac/free-sleep/scripts/add_shortcuts.sh

# --------------------------------------------------------------------------------
# Finish
echo "This is your dac.sock path (if it doesn't end in dac.sock, contact support):"
cat /persistent/free-sleep-data/dac_sock_path.txt 2>/dev/null || echo "No dac.sock path found."

echo -e "\033[0;32mInstallation complete! The Free Sleep server is running and will start automatically on boot.\033[0m"
echo -e "\033[0;32mSee logs with: journalctl -u free-sleep --no-pager --output=cat\033[0m"

if [ "$migration_failed" = "true" ]; then
  echo -e "\033[33mWARNING: Prisma migrations failed! A backup of your database prior to the migration was saved to /persistent/free-sleep-data/free-sleep-copy.db \033[0m"
fi
