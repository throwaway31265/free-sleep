#!/bin/bash

# Fix log file permissions for free-sleep biometrics
# This script ensures all log files in /persistent/free-sleep-data/logs/ are owned by the dac user

LOG_DIR="/persistent/free-sleep-data/logs"

echo "Fixing log file permissions in $LOG_DIR..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "This script must be run as root (use sudo)"
    exit 1
fi

# Check if log directory exists
if [ ! -d "$LOG_DIR" ]; then
    echo "Log directory $LOG_DIR does not exist. Creating it..."
    mkdir -p "$LOG_DIR"
fi

# Check if dac user exists
if ! id "dac" &>/dev/null; then
    echo "Error: dac user does not exist"
    exit 1
fi

# Fix ownership of the logs directory and all files within it
echo "Setting ownership of $LOG_DIR and all files to dac:dac..."
chown -R dac:dac "$LOG_DIR"

# Set appropriate permissions
echo "Setting permissions..."
chmod 755 "$LOG_DIR"
find "$LOG_DIR" -type f -name "*.log" -exec chmod 644 {} \;

echo "Log file permissions fixed successfully!"
echo "Contents of $LOG_DIR:"
ls -la "$LOG_DIR"
