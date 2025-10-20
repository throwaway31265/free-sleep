#!/bin/bash

sh /home/dac/free-sleep/scripts/unblock_internet_access.sh
sh /home/dac/free-sleep/scripts/setup_python.sh
sh /home/dac/free-sleep/scripts/install_python_packages.sh
sh /home/dac/free-sleep/scripts/setup_streamer_service.sh
sh /home/dac/free-sleep/scripts/setup_ambient_light_service.sh
sh /home/dac/free-sleep/scripts/block_internet_access.sh
cd /home/dac/free-sleep/biometrics/sleep_detection && /home/dac/venv/bin/python calibrate_sensor_thresholds.py
