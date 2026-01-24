#!/bin/bash

# Create a systemd service file for python streamer

echo "Creating systemd service file at /etc/systemd/system/free-sleep-stream.service..."
cat > "/etc/systemd/system/free-sleep-stream.service" <<EOF
[Unit]
Description=Free Sleep Streamer
After=network.target

[Service]
ExecStart=/home/dac/venv/bin/python /home/dac/free-sleep/biometrics/stream/stream.py
WorkingDirectory=/home/dac/free-sleep/biometrics/
Restart=always
User=dac

[Install]
WantedBy=multi-user.target
EOF

echo "Reloading systemd daemon and enabling the service..."
systemctl daemon-reload
systemctl enable free-sleep-stream.service

# Start the service
echo "Starting the free-sleep-stream service..."
systemctl start free-sleep-stream.service

# Display service status
echo "Checking service status..."
systemctl status free-sleep-stream.service --no-pager

