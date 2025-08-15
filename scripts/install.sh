#!/bin/bash
# Exit immediately on error, on undefined variables, and on error in pipelines
set -euo pipefail

# --------------------------------------------------------------------------------
# Variables
REPO_URL="https://github.com/nikita/free-sleep/archive/refs/heads/main.zip"
ZIP_FILE="free-sleep.zip"
REPO_DIR="/home/dac/free-sleep"
SERVER_DIR="$REPO_DIR/server"
USERNAME="dac"

# --------------------------------------------------------------------------------
# Download the repository
echo "Downloading the repository..."
curl -L -o "$ZIP_FILE" "$REPO_URL"

echo "Unzipping the repository..."
unzip -o -q "$ZIP_FILE"
echo "Removing the zip file..."
rm -f "$ZIP_FILE"

# Clean up existing directory and move new code into place
echo "Setting up the installation directory..."
rm -rf "$REPO_DIR"
mv free-sleep-main "$REPO_DIR"

# Optional: remove the leftover free-sleep-main directory if the `unzip` created extra files
# (In this script we're already moving it, so there's no leftover)
# rm -rf free-sleep-main

chown -R "$USERNAME":"$USERNAME" "$REPO_DIR"

# --------------------------------------------------------------------------------
# Install or update Bun
# - We check once. If it’s not installed, install it.
echo "Checking if Bun is installed for user '$USERNAME'..."
if sudo -u "$USERNAME" bash -c 'command -v bun' >/dev/null 2>&1; then
  echo "Bun is already installed for user '$USERNAME'."
else
  echo "Bun is not installed. Installing for user '$USERNAME'..."
  sudo -u "$USERNAME" bash -c 'curl -fsSL https://bun.sh/install | bash'
  # Ensure Bun environment variables are in the DAC user’s profile:
  if ! grep -q 'export BUN_INSTALL=' "/home/$USERNAME/.profile"; then
    echo -e '\nexport BUN_INSTALL="/home/dac/.bun"\nexport PATH="$BUN_INSTALL/bin:$PATH"\n' \
      >>"/home/$USERNAME/.profile"
  fi
fi

# --------------------------------------------------------------------------------
# Setup /persistent/free-sleep-data (migrate old configs, logs, etc.)
mkdir -p /persistent/free-sleep-data/logs/
mkdir -p /persistent/free-sleep-data/lowdb/

# Extract the DAC_SOCKET path from frank.sh (if present) and put it in DAC_SOCK_PATH file
grep -oP '(?<=DAC_SOCKET=)[^ ]*dac.sock' /opt/eight/bin/frank.sh >/persistent/free-sleep-data/dac_sock_path.txt

# DO NOT REMOVE, OLD VERSIONS WILL LOSE settings & schedules
FILES_TO_MOVE=(
  "/home/dac/free-sleep-database/settingsDB.json:/persistent/free-sleep-data/lowdb/settingsDB.json"
  "/home/dac/free-sleep-database/schedulesDB.json:/persistent/free-sleep-data/lowdb/schedulesDB.json"
  "/home/dac/dac_sock_path.txt:/persistent/free-sleep-data/dac_sock_path.txt"
)

for entry in "${FILES_TO_MOVE[@]}"; do
  IFS=":" read -r SOURCE_FILE DESTINATION <<<"$entry"
  if [ -f "$SOURCE_FILE" ]; then
    mv "$SOURCE_FILE" "$DESTINATION"
    echo "Moved $SOURCE_FILE to $DESTINATION"
  fi
done

# Change ownership and permissions
chown -R "$USERNAME":"$USERNAME" /persistent/free-sleep-data/
chmod 770 /persistent/free-sleep-data/
chmod g+s /persistent/free-sleep-data/

# --------------------------------------------------------------------------------
# Install server dependencies (with IPv6 hang workaround)
echo "Installing dependencies in $SERVER_DIR ..."

if command -v timeout >/dev/null 2>&1; then
  echo "Running bun install with a 180s timeout to detect hangs..."
  if ! sudo -u "$USERNAME" bash -c "cd '$SERVER_DIR' && timeout 180s /home/$USERNAME/.bun/bin/bun install"; then
    echo "bun install failed or timed out. Applying IPv6 workaround and retrying..."
    # Disable IPv6 (runtime)
    sysctl -w net.ipv6.conf.all.disable_ipv6=1 || true
    sysctl -w net.ipv6.conf.default.disable_ipv6=1 || true
    sysctl -w net.ipv6.conf.lo.disable_ipv6=1 || true
    # Persist IPv6 disable across reboots
    if [ -f /etc/sysctl.conf ]; then
      sed -i '/net.ipv6.conf.all.disable_ipv6/d' /etc/sysctl.conf || true
      sed -i '/net.ipv6.conf.default.disable_ipv6/d' /etc/sysctl.conf || true
      sed -i '/net.ipv6.conf.lo.disable_ipv6/d' /etc/sysctl.conf || true
      echo 'net.ipv6.conf.all.disable_ipv6=1' >> /etc/sysctl.conf
      echo 'net.ipv6.conf.default.disable_ipv6=1' >> /etc/sysctl.conf
      echo 'net.ipv6.conf.lo.disable_ipv6=1' >> /etc/sysctl.conf
      sysctl -p || true
    fi
    # Retry bun install
    sudo -u "$USERNAME" bash -c "cd '$SERVER_DIR' && /home/$USERNAME/.bun/bin/bun install"
  fi
else
  echo "'timeout' command not found. Running bun install normally. If it hangs at 'Resolving...', run /home/dac/free-sleep/scripts/disable_ipv6.sh and re-run the installer."
  sudo -u "$USERNAME" bash -c "cd '$SERVER_DIR' && /home/$USERNAME/.bun/bin/bun install"
fi

echo "Running Prisma migrations..."
sudo -u "$USERNAME" bash -c "cd '$SERVER_DIR' && /home/$USERNAME/.bun/bin/bun run migrate deploy"

# --------------------------------------------------------------------------------
# Create systemd service

SERVICE_FILE="/etc/systemd/system/free-sleep.service"

echo "Creating systemd service file at $SERVICE_FILE..."

cat >"$SERVICE_FILE" <<EOF
[Unit]
Description=Free Sleep Server
After=network.target

[Service]
ExecStart=/home/$USERNAME/.bun/bin/bun run dev
WorkingDirectory=$SERVER_DIR
Restart=always
User=$USERNAME
Environment=NODE_ENV=production
Environment=BUN_INSTALL=/home/$USERNAME/.bun
Environment=PATH=/home/$USERNAME/.bun/bin:/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin

[Install]
WantedBy=multi-user.target
EOF

echo "Reloading systemd daemon and enabling the service..."
systemctl daemon-reload
systemctl enable free-sleep.service

echo "Starting free-sleep.service..."
systemctl start free-sleep.service

echo "Checking service status..."
systemctl status free-sleep.service --no-pager || true

# --------------------------------------------------------------------------------
# Graceful device time update (optional)

echo "Attempting to update device time from Google..."
# If the curl fails or is blocked, skip with a warning but don't fail the entire script
if date_string="$(curl -s --head http://google.com | grep '^Date: ' | sed 's/Date: //g')" && [ -n "$date_string" ]; then
  date -s "$date_string" || echo "WARNING: Unable to update system time"
else
  echo -e "\033[0;33mWARNING: Unable to retrieve date from Google... Skipping time update.\033[0m"
fi

# --------------------------------------------------------------------------------
# Setup passwordless reboot for 'dac'

SUDOERS_FILE="/etc/sudoers.d/$USERNAME"
SUDOERS_RULE="$USERNAME ALL=(ALL) NOPASSWD: /sbin/reboot"

if sudo grep -Fxq "$SUDOERS_RULE" "$SUDOERS_FILE" 2>/dev/null; then
  echo "Rule for '$USERNAME' reboot permissions already exists."
else
  echo "$SUDOERS_RULE" | sudo tee "$SUDOERS_FILE" >/dev/null
  sudo chmod 440 "$SUDOERS_FILE"
  echo "Passwordless permission for reboot granted to '$USERNAME'."
fi

echo ""

# --------------------------------------------------------------------------------
# Restart free-sleep-stream if it exists

if systemctl list-units --full --all | grep -q "free-sleep-stream"; then
  echo "Restarting free-sleep-stream service..."
  systemctl restart free-sleep-stream
else
  echo "free-sleep-stream service does not exist. Skipping restart."
fi

echo ""

# --------------------------------------------------------------------------------
# Finish
echo "This is your dac.sock path (if it doesn't end in dac.sock, contact support):"
cat /persistent/free-sleep-data/dac_sock_path.txt 2>/dev/null || echo "No dac.sock path found."

echo -e "\033[0;32mInstallation complete! The Free Sleep server is running and will start automatically on boot.\033[0m"
echo -e "\033[0;32mSee logs with: journalctl -u free-sleep --no-pager --output=cat\033[0m"