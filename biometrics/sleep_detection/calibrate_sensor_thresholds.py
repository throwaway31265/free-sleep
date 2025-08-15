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
    cd /home/dac/free-sleep/biometrics/sleep_detection && /home/dac/venv/bin/python calibrate_sensor_thresholds.py --side=left --start_time="YYYY-MM-DD HH:MM:SS" --end_time="YYYY-MM-DD HH:MM:SS"
"""
import sys
import platform
import os
import gc
from argparse import Namespace, ArgumentParser
import traceback
from typing import Union
from datetime import datetime, timezone, timedelta


sys.path.append(os.getcwd())
FOLDER_PATH = '/Users/ds/main/8sleep_biometrics/data/people/david/raw/loaded/2025-01-10/'
if platform.system().lower() == 'linux':
    FOLDER_PATH = '/persistent/'
    sys.path.append('/home/dac/free-sleep/biometrics/')

# This must run before the other local import in order to set up the logger
from get_logger import get_logger

logger = get_logger('calibrate-sensor')

from data_types import *
from load_raw_files import load_raw_files
from piezo_data import load_piezo_df, detect_presence_piezo, identify_baseline_period
from cap_data import load_cap_df, create_cap_baseline_from_cap_df, save_baseline
from resource_usage import get_memory_usage_unix, get_available_memory_mb
from biometrics_helpers import validate_datetime_utc


def _parse_args() -> Union[Namespace, None]:
    # Argument parser setup
    parser = ArgumentParser(description="Process presence intervals with UTC datetime.")

    # Named arguments with default values if needed
    parser.add_argument(
        "--side",
        choices=["left", "right"],
        required=False,
        help="Side of the bed to process (left or right)."
    )
    parser.add_argument(
        "--start_time",
        type=validate_datetime_utc,
        required=False,
        help="Start time in UTC format 'YYYY-MM-DD HH:MM:SS'."
    )
    parser.add_argument(
        "--end_time",
        type=validate_datetime_utc,
        required=False,
        help="End time in UTC format 'YYYY-MM-DD HH:MM:SS'."
    )

    # Parse arguments
    args = parser.parse_args()
    if args.start_time is None or args.end_time is None or args.side is None:
        return None
    # Validate that start_time is before end_time
    if args.start_time >= args.end_time:
        raise ValueError("--start_time must be earlier than --end_time")

    return args


def calibrate_sensor_thresholds(side: Side, start_time: datetime, end_time: datetime, folder_path: str):
    expected_row_count = int((end_time - start_time).total_seconds())
    logger.debug(f"Calibrating sensors for {side} side | {start_time.isoformat()} -> {end_time.isoformat()} | Expected row count: {expected_row_count:,}")

    data = load_raw_files(
        folder_path,
        start_time,
        end_time,
        side,
        sensor_count=1,
        raw_data_types=['capSense', 'piezo-dual']
    )

    piezo_df = load_piezo_df(data, side, expected_row_count=expected_row_count)
    if piezo_df is None or piezo_df.empty:
        raise ValueError('No piezo data available for calibration; aborting')
    detect_presence_piezo(
        piezo_df,
        side,
        rolling_seconds=10,
        threshold_percent=0.70,
        range_threshold=80_000,
        range_rolling_seconds=10,
        clean=False
    )

    cap_df = load_cap_df(data, side, expected_row_count=expected_row_count)
    if cap_df is None or cap_df.empty:
        raise ValueError('No capacitance data available for calibration; aborting')
    # Cleanup data
    del data
    gc.collect()

    merged_df = piezo_df.merge(cap_df, on='ts', how='inner')
    if merged_df.empty:
        raise ValueError('Merged dataframe is empty; cannot calibrate')
    # Free up memory from old dfs
    piezo_df.drop(piezo_df.index, inplace=True)
    cap_df.drop(cap_df.index, inplace=True)
    del piezo_df
    del cap_df
    gc.collect()

    # Create baseline
    baseline_start_time, baseline_end_time = identify_baseline_period(merged_df, side, threshold_range=10_000, empty_minutes=5)
    if baseline_start_time is None or baseline_end_time is None:
        raise ValueError('Unable to find a valid baseline period for calibration')
    cap_baseline = create_cap_baseline_from_cap_df(merged_df, baseline_start_time, baseline_end_time, side, min_std=5)
    save_baseline(side, cap_baseline)

    # Cleanup
    merged_df.drop(merged_df.index, inplace=True)
    del merged_df
    gc.collect()


def calibrate_both_sides():
    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(hours=14)
    logger.info(
        f'No args passed to calibrate_sensor_thresholds.py, calibrating for the last 14 hours... {start_time.isoformat()} -> {end_time.isoformat()}')

    calibrate_sensor_thresholds(
        'left',
        start_time,
        end_time,
        FOLDER_PATH,
    )
    calibrate_sensor_thresholds(
        'right',
        start_time,
        end_time,
        FOLDER_PATH,
    )


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

        if args is None:
            calibrate_both_sides()
        else:
            calibrate_sensor_thresholds(
                args.side,
                args.start_time,
                args.end_time,
                FOLDER_PATH,
            )
    except KeyboardInterrupt:
        logger.info('Keyboard interrupt signal received, exiting...')
    except Exception as e:
        logger.error(e)
        stack = traceback.format_exc()
        logger.error(stack)
        logger.error('Error calibrating sensors, exiting...')
