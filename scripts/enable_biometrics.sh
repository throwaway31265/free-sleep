#!/bin/bash

set -e  # Exit immediately if any command fails
set -o pipefail  # Catch errors in piped commands
set -u  # Treat unset variables as errors

RED='\033[0;31m'
NC='\033[0m' # No Color

# Catch any errors
trap 'rc=$?;
if [ "$rc" -ne 0 ]; then
  echo ""
  echo -e "${RED}Error enabling biometrics!${NC}"
  echo -e "${RED}Command that failed: $BASH_COMMAND - Exit code $rc ${NC}"
  echo ""
fi
sh /home/dac/free-sleep/scripts/block_internet_access.sh
exit $rc' EXIT


sh /home/dac/free-sleep/scripts/unblock_internet_access.sh
sh /home/dac/free-sleep/scripts/setup_python.sh
sh /home/dac/free-sleep/scripts/install_python_packages.sh
sh /home/dac/free-sleep/scripts/setup_streamer_service.sh
sh /home/dac/free-sleep/scripts/block_internet_access.sh
cd /home/dac/free-sleep/biometrics/sleep_detection && /home/dac/venv/bin/python calibrate_sensor_thresholds.py
