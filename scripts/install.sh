#!/bin/bash

# Variables
REPO_URL="https://github.com/throwaway31265/free-sleep/archive/refs/heads/main.zip"
ZIP_FILE="free-sleep.zip"
REPO_DIR="/home/dac/free-sleep"
SERVER_DIR="$REPO_DIR/server"
SERVICE_FILE="/etc/systemd/system/free-sleep.service"

# -----------------------------------------------------------------------------------------------------

# Step 1: Download the repository
echo "Downloading the repository..."
curl -L -o "$ZIP_FILE" "$REPO_URL"

# Step 2: Unzip the repository
echo "Unzipping the repository..."
unzip -o "$ZIP_FILE"

echo "Removing the zip file..."
rm "$ZIP_FILE"

# Step 3: Move files to the installation directory
echo "Setting up the installation directory..."
mv free-sleep-main "$REPO_DIR"
chown -R dac:dac "$REPO_DIR"

# -----------------------------------------------------------------------------------------------------

# Install volta
sudo -u dac bash -c 'curl https://get.volta.sh | bash'


if sudo -u dac bash -c 'command -v volta' > /dev/null 2>&1; then
    echo "Volta is already installed for user 'dac'."
else
    echo "Volta is not installed. Installing for user 'dac'..."
    sudo -u dac bash -c 'curl https://get.volta.sh | bash'
    echo -e '\nexport VOLTA_HOME="/home/dac/.volta"\nexport PATH="$VOLTA_HOME/bin:$PATH"\n' >> /home/root/.profile
fi

# This will skip automatically if this node version is already installed
sudo -u dac bash -c "source /home/dac/.profile && cd /home/dac/free-sleep/server && volta install node@22.13.0"

# -----------------------------------------------------------------------------------------------------

# Step 4: Install dependencies as user dac
echo "Installing dependencies..."
sudo -u dac bash -c "cd $SERVER_DIR && npm install"

# -----------------------------------------------------------------------------------------------------

# Step 5: Create a systemd service file
echo "Creating systemd service file at $SERVICE_FILE..."
cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Free Sleep Server
After=network.target

[Service]
ExecStart=/home/dac/.volta/bin/npm run start
WorkingDirectory=$SERVER_DIR
Restart=always
User=dac
Environment=NODE_ENV=production
Environment=VOLTA_HOME=/home/dac/.volta
Environment=PATH=/home/dac/.volta/bin:/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin

[Install]
WantedBy=multi-user.target
EOF

# Step 6: Reload systemd and enable the service
echo "Reloading systemd daemon and enabling the service..."
systemctl daemon-reload
systemctl enable free-sleep.service

# Step 7: Start the service
echo "Starting the free-sleep server..."
systemctl start free-sleep.service

# Step 8: Display service status
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

# -----------------------------------------------------------------------------------------------------
# Setup data folder

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

echo -e "\033[0;32mInstallation complete! The Free Sleep server is running and will start automatically on boot.\033[0m"
echo -e "\033[0;32mSee free-sleep logs with journalctl -u free-sleep --no-pager --output=cat\033[0m"

