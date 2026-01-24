#!/bin/bash

# Shell script to set up sshd as a systemd service and configure sshd_config

echo "This script will:"
echo "- Replace the existing ssh config at /etc/ssh/sshd_config"
echo "- Setup the ssh service to auto run at boot"
echo "- Remove the default authorized ssh keys the /etc/ssh/authorized_keys"
echo "- Prompt you to add your public ssh key"
echo "Press Enter to continue or Ctrl+C to quit..."

read -r

SERVICE_FILE="/etc/systemd/system/sshd.service"
SSHD_CONFIG_FILE="/etc/ssh/sshd_config"
SSH_CONFIG_FILE="/etc/ssh/ssh_config"
AUTHORIZED_KEYS_FILE="/home/root/ssh/authorized_keys"

echo "Creating new sshd_config at $SSHD_CONFIG_FILE..."
[ -f "$SSHD_CONFIG_FILE" ] && rm "$SSHD_CONFIG_FILE"
[ -f "$SSH_CONFIG_FILE" ] && rm "$SSH_CONFIG_FILE"

cat > "$SSHD_CONFIG_FILE" <<EOF
AllowUsers root rewt
AuthorizedKeysFile $AUTHORIZED_KEYS_FILE
ChallengeResponseAuthentication no
ClientAliveCountMax 4
ClientAliveInterval 15
Compression no
ListenAddress 0.0.0.0
PasswordAuthentication yes
PermitRootLogin yes
PermitTTY yes
Port 8822
PubkeyAuthentication yes
Subsystem	sftp	/usr/libexec/sftp-server
UsePAM yes
EOF

cp "$SSHD_CONFIG_FILE" "$SSH_CONFIG_FILE"

echo "Setting correct permissions for $SSHD_CONFIG_FILE..."
chmod 600 "$SSHD_CONFIG_FILE"
chown root:root "$SSHD_CONFIG_FILE"
chmod 600 "$SSH_CONFIG_FILE"
chown root:root "$SSH_CONFIG_FILE"

echo "Removing existing authorized_keys..."
rm /etc/ssh/authorized_keys

mkdir /home/root/ssh/

echo "Please paste your SSH public key below and press Enter:"
read ssh_key
echo "$ssh_key" >> "$AUTHORIZED_KEYS_FILE"

chmod 644 "$AUTHORIZED_KEYS_FILE"
chown root:root "$AUTHORIZED_KEYS_FILE"


echo "Creating systemd service file for sshd at $SERVICE_FILE..."

cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=OpenSSH Server
After=network.target

[Service]
ExecStart=/usr/sbin/sshd -D
Restart=always

[Install]
WantedBy=multi-user.target
EOF

mkdir -p /var/run/sshd
chmod 0755 /var/run/sshd
chown root:root /var/run/sshd


echo "Reloading systemd daemon to apply the new service..."
systemctl daemon-reload

echo "Enabling sshd service to start at boot..."
systemctl enable sshd.service

echo "Starting sshd service now..."
systemctl start sshd.service

echo "Checking sshd service status..."
systemctl status sshd.service --no-pager


echo ""
echo "SSH service setup complete!"
echo "SSH uses port 8822!"
echo "SSH into your device with \`ssh root@<IP> -p 8822\`"
echo ""
