#!/bin/bash

# Variables
REPO_URL="https://github.com/nikita/free-sleep/archive/refs/heads/main.zip"
ZIP_FILE="free-sleep.zip"
REPO_DIR="/home/dac/free-sleep"
SERVER_DIR="$REPO_DIR/server"
SERVICE_FILE="/etc/systemd/system/free-sleep.service"

# -----------------------------------------------------------------------------------------------------
# Download the repository
echo "Downloading the repository..."
curl -L -o "$ZIP_FILE" "$REPO_URL"

# Unzip the repository
echo "Unzipping the repository..."
unzip -o "$ZIP_FILE"

echo "Removing the zip file..."
rm "$ZIP_FILE"

# Move files to the installation directory
echo "Setting up the installation directory..."
rm -rf "$REPO_DIR"
mv free-sleep-main "$REPO_DIR"
chown -R dac:dac "$REPO_DIR"

# -----------------------------------------------------------------------------------------------------

# Check and install Bun if not present
if sudo -u dac bash -c 'command -v bun' > /dev/null 2>&1; then
    echo "Bun is already installed for user 'dac'."
else
    echo "Bun is not installed. Installing for user 'dac'..."
    sudo -u dac bash -c 'curl -fsSL https://bun.sh/install | bash'
    echo "Adding Bun to PATH..."
    echo -e '\nexport BUN_INSTALL="$HOME/.bun"\nexport PATH="$BUN_INSTALL/bin:$PATH"\n' >> /home/root/.profile
    echo -e '\nexport BUN_INSTALL="$HOME/.bun"\nexport PATH="$BUN_INSTALL/bin:$PATH"\n' >> /home/dac/.profile
    source /home/dac/.profile
fi

# -----------------------------------------------------------------------------------------------------
# Setup data folder in /persistent/

# Create directories if they don't exist
mkdir -p /persistent/free-sleep-data/logs/
mkdir -p /persistent/free-sleep-data/lowdb/

grep -oP '(?<=DAC_SOCKET=)[^ ]*dac.sock' /opt/eight/bin/frank.sh > /persistent/free-sleep-data/dac_sock_path.txt

# DO NOT REMOVE, OLD VERSIONS WILL LOSE settings & schedules
# Migrate old config/DB to new /persistent/free-sleep-data/
FILES_TO_MOVE=(
  "/home/dac/free-sleep-database/settingsDB.json:/persistent/free-sleep-data/lowdb/settingsDB.json"
  "/home/dac/free-sleep-database/schedulesDB.json:/persistent/free-sleep-data/lowdb/schedulesDB.json"
  "/home/dac/dac_sock_path.txt:/persistent/free-sleep-data/dac_sock_path.txt"
)

# Loop through each file and move if it exists
for entry in "${FILES_TO_MOVE[@]}"; do
  IFS=":" read -r SOURCE_FILE DESTINATION <<< "$entry"

  if [ -f "$SOURCE_FILE" ]; then
    mv "$SOURCE_FILE" "$DESTINATION"
    echo "Moved $SOURCE_FILE to $DESTINATION"
  fi
done


# Change ownership recursively (-R flag)
chown -R dac:dac /persistent/free-sleep-data/

# Set directory permissions
chmod 770 /persistent/free-sleep-data/
chmod g+s /persistent/free-sleep-data/

# -----------------------------------------------------------------------------------------------------
# Install dependencies as user dac

echo "Installing dependencies..."
sudo -u dac bash -c "cd $SERVER_DIR && bun install"
echo "Running prisma migration"
sudo -u dac bash -c "cd $SERVER_DIR && bun run migrate deploy"

# -----------------------------------------------------------------------------------------------------

# Create a systemd service file
echo "Creating systemd service file at $SERVICE_FILE..."
cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Free Sleep Server
After=network.target

[Service]
ExecStart=/home/dac/.bun/bin/bun run start
WorkingDirectory=$SERVER_DIR
Restart=always
User=dac
Environment=NODE_ENV=production
Environment=BUN_INSTALL=/home/dac/.bun
Environment=PATH=/home/dac/.bun/bin:/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable the service
echo "Reloading systemd daemon and enabling the service..."
systemctl daemon-reload
systemctl enable free-sleep.service

# Start the service
echo "Starting the free-sleep server..."
systemctl start free-sleep.service

# Display service status
echo "Checking service status..."
systemctl status free-sleep.service --no-pager

# Sometimes the device time gets reset to 2010, this resets the device time
echo "Updating device time"
date -s "$(curl -s --head http://google.com | grep ^Date: | sed 's/Date: //g')"


# -----------------------------------------------------------------------------------------------------
# Setup ability to reboot pod without sudo permission for dac user
USERNAME="dac"
SUDOERS_FILE="/etc/sudoers.d/$USERNAME"
SUDOERS_RULE="$USERNAME ALL=(ALL) NOPASSWD: /sbin/reboot"

# 2. Check if the sudoers rule already exists
if sudo grep -Fxq "$SUDOERS_RULE" "$SUDOERS_FILE" 2>/dev/null; then
    echo "Rule for '$USERNAME' reboot permissions already exists."
else
    echo "$SUDOERS_RULE" | sudo tee "$SUDOERS_FILE" > /dev/null
    sudo chmod 440 "$SUDOERS_FILE"
    echo "Passwordless permission for reboot granted to '$USERNAME'."
fi

# ---------------------------------------------------------------------------------------

echo -e "\033[0;32mInstallation complete! The Free Sleep server is running and will start automatically on boot.\033[0m"
echo -e "\033[0;32mSee free-sleep logs with journalctl -u free-sleep --no-pager --output=cat\033[0m"

echo "This is your dac.sock path, if the output below doesn't end in dac.sock, reach out to us on Discord"
cat /persistent/free-sleep-data/dac_sock_path.txt
# -----------------------------------------------------------------------------------------------------
