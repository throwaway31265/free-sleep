# python3 calculate_biometrics.py --side=left --start_time="2025-02-06 03:00:00" --end_time="2025-02-06 15:00:00"
# python3 calculate_vitals.py --side=right --start_time="2025-02-08 06:25:00" --end_time="2025-02-08 14:16:00"
# TODO: Support users manually starting/ending sleep time

import sys

FOLDER_PATH = '/persistent/'

sys.path.append('/home/dac/free-sleep/biometrics/')

import sqlite3
import json
import gc
import os
import traceback
from argparse import Namespace, ArgumentParser
from datetime import timezone, datetime
import numpy as np
import platform

import pandas as pd

sys.path.append(os.getcwd())
from data_types import *
from get_logger import get_logger
from biometrics_helpers import validate_datetime_utc
from resource_usage import get_memory_usage_unix, get_available_memory_mb
from load_raw_files import load_raw_files
from calculations import estimate_heart_rate_intervals, clean_df_pred
from run_data import RunData, RuntimeParams
from db import DB_FILE_PATH

logger = get_logger()


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
        logger.error("Error: --start_time must be earlier than --end_time.")
        sys.exit(1)

    return args


def _load_piezo_df(start_time: datetime, end_time: datetime, side: Side, folder_path: str) -> pd.DataFrame:
    data = load_raw_files(folder_path, start_time, end_time, side, sensor_count=2, raw_data_types=['piezo-dual'])

    piezo_df = pd.DataFrame(data['piezo_dual'])

    # Ensure ts column is in datetime format before setting index
    piezo_df['ts'] = pd.to_datetime(piezo_df['ts'])

    # Sort and set index
    piezo_df.sort_values(by='ts', ascending=True, inplace=True)
    piezo_df.set_index('ts', inplace=True)

    # Drop the rows where the index is between the given timestamps
    piezo_df = piezo_df.loc[start_time:end_time]
    piezo_df.drop(columns=['type', 'freq', 'adc', 'gain'], inplace=True)

    # TODO: Filter periods not present
    return piezo_df


def calculate_vitals(start_time: datetime, end_time: datetime, side: Side, folder_path: str):
    # TESTING
    # side = "right"
    # start_time = datetime.strptime("2025-01-27 06:15:00", "%Y-%m-%d %H:%M:%S")
    # end_time = datetime.strptime("2025-01-27 14:53:00", "%Y-%m-%d %H:%M:%S")
    # folder_path = '/Users/ds/main/8sleep_biometrics/data/people/david/raw/loaded/2025-01-27/'

    piezo_df = _load_piezo_df(start_time, end_time, side, folder_path)
    print(piezo_df.head())
    runtime_params: RuntimeParams = {
        'window': 10,
        'slide_by': 1,
        'moving_avg_size': 120,
        'hr_std_range': (1, 20),
        'hr_percentile': (20, 75),
        'signal_percentile': (0.5, 99.5),
    }
    if f'{side}2' in piezo_df.columns:
        sensor_count = 2
    else:
        sensor_count = 1

    run_data = RunData(
        piezo_df,
        start_time.strftime('%Y-%m-%d %H:%M:%S'),
        end_time.strftime('%Y-%m-%d %H:%M:%S'),
        runtime_params=runtime_params,
        name='',
        side=side,
        sensor_count=sensor_count,
        label='COMPARE',
        log=True
    )

    estimate_heart_rate_intervals(run_data)
    df = run_data.df_pred.copy()
    run_data.df_pred = df.copy()
    clean_df_pred(run_data.df_pred)
    r_window_avg = 15
    r_min_periods = 5

    run_data.df_pred['heart_rate'] = run_data.df_pred['heart_rate'].rolling(window=r_window_avg, min_periods=r_min_periods).mean()

    run_data.df_pred['breathing_rate'] = run_data.df_pred['breathing_rate'].rolling(window=40, min_periods=10).mean()
    run_data.df_pred['hrv'] = run_data.df_pred['hrv'].rolling(window=40, min_periods=10).mean()

    run_data.df_pred['start_time'] = pd.to_datetime(run_data.df_pred['start_time'])
    run_data.df_pred['end_time'] = pd.to_datetime(run_data.df_pred['end_time'])

    # Floor start_time to the nearest 5-minute interval
    run_data.df_pred['timestamp'] = run_data.df_pred['start_time'].dt.floor('3min')

    # Convert timestamps to Unix epoch (for Prisma)
    run_data.df_pred['timestamp'] = run_data.df_pred['timestamp'].astype('int64') // 10 ** 9

    # DEBUGGING Convert epoch columns to formatted datetime strings
    # run_data.df_pred['ts_end'] = pd.to_datetime(run_data.df_pred['period_end'], unit='s').dt.strftime('%Y-%m-%d %H:%M:%S')

    # Group by 5-minute periods and compute averages
    run_data.df_pred = run_data.df_pred.groupby(['timestamp']).agg({
        'heart_rate': 'mean',
        'hrv': 'mean',
        'breathing_rate': 'mean'
    }).reset_index()
    run_data.df_pred['side'] = side
    run_data.df_pred['ts_start'] = pd.to_datetime(run_data.df_pred['timestamp'], unit='s').dt.strftime('%Y-%m-%d %H:%M:%S')
    run_data.df_pred['heart_rate'] = run_data.df_pred['heart_rate'].round(0).astype(int)
    run_data.df_pred['hrv'] = run_data.df_pred['hrv'].round(0).astype(int)
    run_data.df_pred['breathing_rate'] = run_data.df_pred['breathing_rate'].round(0).astype(int)
    run_data.df_pred.head()
    # Save to SQLite (for Prisma to use)
    conn = sqlite3.connect(DB_FILE_PATH)
    run_data.df_pred.to_sql('vitals', conn, if_exists="append", index=False)


if __name__ == "__main__":
    if get_available_memory_mb() < 400:
        error = MemoryError('Available memory is too little, exiting...')
        logger.error(error)
        raise error
    args = _parse_args()
    logger.debug(f"Memory Usage: {get_memory_usage_unix():.2f} MB")
    logger.debug(f"Free Memory: {get_available_memory_mb()} MB")

    calculate_vitals(args.start_time, args.end_time, args.side, '/persistent/')
