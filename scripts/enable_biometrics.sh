#!/bin/sh

python3 /home/dac/free-sleep/scripts/is_biometrics_installed.py
result=$?
biometrics_installed=false

if [ $result -eq 0 ]; then
  echo "Biometrics environment not setup, continuing with installation..."
elif [ $result -eq 1 ]; then
  echo "Biometrics is already installed; refreshing dependencies and enabling the streamer..."
  biometrics_installed=true
else
  echo "Unable to check if biometrics installed, exiting..."
  exit 1
fi


set -eu

RED='\033[0;31m'
NC='\033[0m' # No Color

# Catch any errors
trap '
  exit_status=$?
  # Reporting an error must not prevent firewall cleanup or hide the original failure.
  set +e
  if [ "$exit_status" -ne 0 ]; then
    echo ""
    printf "%b\n" "${RED}Error enabling biometrics! Exit code $exit_status${NC}"
    echo ""
    curl -s --max-time 10 -X POST http://127.0.0.1:3000/api/services \
      -H "Content-Type: application/json" \
      -d "{
        \"biometrics\": {
          \"jobs\": {
            \"installation\": {
              \"status\": \"failed\"
            }
          }
        }
      }"
  fi
  sh /home/dac/free-sleep/scripts/block_internet_access.sh
  exit "$exit_status"
' EXIT


sh /home/dac/free-sleep/scripts/unblock_internet_access.sh
if [ "$biometrics_installed" = false ] || [ ! -x /home/dac/venv/bin/python ]; then
  sh /home/dac/free-sleep/scripts/setup_python.sh
fi
sh /home/dac/free-sleep/scripts/install_python_packages.sh
sh /home/dac/free-sleep/scripts/setup_streamer_service.sh

# Mark the installation status as healthy
curl -X POST http://127.0.0.1:3000/api/services \
  -H "Content-Type: application/json" \
  -d '{
    "biometrics": {
      "jobs": {
        "installation": {
          "status": "healthy"
        }
      }
    }
  }'

sh /home/dac/free-sleep/scripts/block_internet_access.sh
if [ "$biometrics_installed" = false ]; then
  cd /home/dac/free-sleep/biometrics/sleep_detection && /home/dac/venv/bin/python calibrate_sensor_thresholds.py
fi
