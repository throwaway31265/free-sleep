#!/bin/bash

echo "WARNING: This will permanently delete all Free Sleep data located at /persistent/free-sleep-data/"
echo "This includes schedules, biometrics, and settings."
echo "After deleting, this will attempt to reinstall free-sleep"
read -p "Are you sure you want to continue? (y/N): " confirm

if [[ "$confirm" =~ ^[Yy]$ ]]; then
    echo "Deleting Free Sleep data..."
    rm -rf /persistent/free-sleep-data/
    echo "Deleted /persistent/free-sleep-data/"
    echo "Reinstalling free-sleep"
    sh /home/dac/free-sleep/scripts/update.sh
else
    echo "Cancelled"
fi
