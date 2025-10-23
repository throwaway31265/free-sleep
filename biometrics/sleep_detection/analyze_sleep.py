"""
This script calibrates sensor thresholds by analyzing historical raw data to establish a baseline
for sleep detection using piezoelectric and capacitance sensors.

Key functionalities:
- Loads raw `.RAW` sensor data for a specified time range and bed side.
- Processes piezoelectric sensor data to detect presence using signal thresholds.
- Analyzes capacitance sensor data to create a baseline for occupancy detection.
- Identifies a baseline period and saves the capacitance sensor baseline for future reference.
- Optimized for memory efficiency using garbage collection (`gc`).

Usage:
Run the script with required parameters:
    /home/dac/venv/bin/python calibrate_sensor_thresholds.py --side=left --start_time="YYYY-MM-DD HH:MM:SS" --end_time="YYYY-MM-DD HH:MM:SS"
    cd /home/dac/free-sleep/biometrics/sleep_detection && /home/dac/venv/bin/python -B analyze_sleep.py --side=left --start_time="2025-08-07 04:00:00" --end_time="2025-08-07 15:00:00"
"""

import sys
import platform

import json
import gc
import os
import traceback
from argparse import ArgumentParser, Namespace
import numpy as np
from datetime import datetime, timezone

sys.path.append(os.getcwd())

if platform.system().lower() == 'linux':
    FOLDER_PATH = '/persistent/'
    sys.path.append('/home/dac/free-sleep/biometrics/')

from get_logger import get_logger
# This must run before the other local import in order to set up the logger
logger = get_logger('sleep-analyzer')

from sleep_detector import detect_sleep, detect_movement
from resource_usage import get_memory_usage_unix, get_available_memory_mb
from biometrics_helpers import validate_datetime_utc



def _parse_args() -> Namespace:
    # Argument parser setup
    parser = ArgumentParser(description="Process presence intervals with UTC datetime.")

    # Named arguments with default values if needed
    parser.add_argument(
        "--side",
        choices=["left", "right"],
        required=True,
        help="Side of the bed to process (left or right)."
    )
    parser.add_argument(
        "--start_time",
        type=validate_datetime_utc,
        required=True,
        help="Start time in UTC format 'YYYY-MM-DD HH:MM:SS'."
    )
    parser.add_argument(
        "--end_time",
        type=validate_datetime_utc,
        required=True,
        help="End time in UTC format 'YYYY-MM-DD HH:MM:SS'."
    )

    # Parse arguments
    args = parser.parse_args()

    # Validate that start_time is before end_time
    if args.start_time >= args.end_time:
        raise ValueError("--start_time must be earlier than --end_time")
    return args


if __name__ == "__main__":
    try:
        logger.debug(f"START Free Memory: {get_available_memory_mb()} MB")
        logger.debug(f"START Memory Usage: {get_memory_usage_unix():.2f} MB")
        if get_available_memory_mb() < 400:
            raise MemoryError('Available memory is too little, exiting...')

        if logger.env == 'prod':
            args = _parse_args()
        else:
            # DEBUGGING
            date = '2025-01-20'
            FOLDER_PATH = f'/Users/ds/main/8sleep_biometrics/data/people/david/raw/loaded/{date}/'
            args = Namespace(
                side="right",
                start_time=datetime.strptime(f'{date} 07:00:00', '%Y-%m-%d %H:%M:%S').replace(tzinfo=timezone.utc),
                end_time=datetime.strptime(f'{date} 15:00:00', '%Y-%m-%d %H:%M:%S').replace(tzinfo=timezone.utc),
            )


        merged_df = detect_sleep(
            args.side,
            args.start_time,
            args.end_time,
            FOLDER_PATH
        )

        detect_movement(args.side, merged_df)

        logger.debug(f"END Memory Usage: {get_memory_usage_unix():.2f} MB")
        logger.debug(f"END Free Memory: {get_available_memory_mb()} MB")
    except KeyboardInterrupt:
        logger.info('Keyboard interrupt signal received, exiting...')
    except Exception as e:
        logger.error(e)
        stack = traceback.format_exc()
        logger.error(stack)
        logger.error('Error analyzing sleep, exiting...')

