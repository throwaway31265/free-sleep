#!/bin/bash

# Create a systemd service file for ambient light sensor monitoring

echo "Creating systemd service file at /etc/systemd/system/free-sleep-ambient-light.service..."
cat > "/etc/systemd/system/free-sleep-ambient-light.service" <<EOF
[Unit]
Description=Free Sleep Ambient Light Sensor Monitor
After=network.target

[Service]
ExecStart=/home/dac/venv/bin/python /home/dac/free-sleep/biometrics/stream/ambient_light_stream.py
WorkingDirectory=/home/dac/free-sleep/biometrics/
Restart=always
User=root

[Install]
WantedBy=multi-user.target
EOF

echo "Reloading systemd daemon and enabling the service..."
systemctl daemon-reload
systemctl enable free-sleep-ambient-light.service

# Start the service
echo "Starting the free-sleep-ambient-light service..."
systemctl start free-sleep-ambient-light.service

# Display service status
echo "Checking service status..."
systemctl status free-sleep-ambient-light.service --no-pager
