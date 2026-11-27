#!/bin/bash
set -eu

# Create the systemd service that forwards NATS room/bed temperatures to the server (autopilot input).
# On pods without NATS the reader exits cleanly, and Restart=on-failure leaves it stopped.

VENV_PYTHON="/home/dac/venv/bin/python"
SERVICE_NAME="free-sleep-environment.service"
SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME"

if [ ! -x "$VENV_PYTHON" ]; then
  echo "Biometrics Python venv not found at $VENV_PYTHON, skipping $SERVICE_NAME setup."
  exit 0
fi

echo "Creating systemd service file at $SERVICE_FILE..."
cat > "$SERVICE_FILE" <<UNIT
[Unit]
Description=Free Sleep Environment Reader
After=network.target free-sleep.service
# Give up (unit "failed") after 10 crashes in an hour instead of retrying every 30 s forever
StartLimitIntervalSec=3600
StartLimitBurst=10

[Service]
ExecStart=$VENV_PYTHON /home/dac/free-sleep/biometrics/environment/environment_reader.py
WorkingDirectory=/home/dac/free-sleep/biometrics/
Restart=on-failure
RestartSec=30
User=dac

[Install]
WantedBy=multi-user.target
UNIT

echo "Reloading systemd daemon and enabling the service..."
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"

# Reload installed code and clear any earlier start-limit failure.
echo "Restarting the $SERVICE_NAME service..."
systemctl reset-failed "$SERVICE_NAME" || true
systemctl restart "$SERVICE_NAME"

# A clean exit on pods without NATS reports inactive; that is not an install failure.
echo "Checking service status..."
systemctl status "$SERVICE_NAME" --no-pager || true
