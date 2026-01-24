"""
This module processes capacitance sensor data to detect presence and establish baselines
for sleep detection.

Key functionalities:
- Loads capacitance sensor data into a Pandas DataFrame.
- Creates and saves baseline values for capacitance sensors to improve sleep detection accuracy.
- Detects presence based on capacitance changes using rolling window analysis.
- Supports baseline calibration for each bed side (`left` and `right`).
- Uses efficient vectorized operations for fast presence detection.

Usage:
- Use `load_cap_df(data, side)` to load raw capacitance sensor data.
- Use `create_cap_baseline_from_cap_df(merged_df, start_time, end_time, side)` to establish a baseline.
- Use `detect_presence_cap(merged_df, cap_baseline, side)` to determine presence intervals.
"""

import os
import json
import math
import pandas as pd
from datetime import datetime
from data_types import *
from get_logger import get_logger

logger = get_logger()

LEFT_CAP_BASE_LINE_FILE_PATH = f'{logger.folder_path}left_cap_baseline.json'
RIGHT_CAP_BASELINE_FILE_PATH = f'{logger.folder_path}right_cap_baseline.json'
pd.set_option('display.width', 300)
pd.set_option('display.max_columns', 50)


def create_cap_baseline_from_cap_df(merged_df: pd.DataFrame, start_time: datetime, end_time: datetime, side: Side, min_std: int = 5) -> CapBaseline:
    logger.debug(f'Creating baseline for capacitance sensors...')
    filtered_df = merged_df[start_time:end_time]
    logger.debug(f'filtered_df: \n{filtered_df.describe()}')
    cap_baseline = {}
    for sensor in [f'{side}_out', f'{side}_cen', f'{side}_in']:
        cap_baseline[sensor] = {
            "mean": filtered_df[sensor].mean(),
            "std": max(filtered_df[sensor].std(), min_std)
        }

    logger.debug(f'cap_baseline: \n{json.dumps(cap_baseline, indent=4)}')
    return cap_baseline


def save_baseline(side: Side, cap_baseline: dict):
    if side == 'right':
        file_path = RIGHT_CAP_BASELINE_FILE_PATH
    else:
        file_path = LEFT_CAP_BASE_LINE_FILE_PATH
    logger.debug(f'Saving {side} side cap_baseline to {file_path}')

    with open(file_path, "w") as json_file:
        json.dump(cap_baseline, json_file, indent=4)
        json_file.close()


def load_baseline(side: Side):
    if side == 'right':
        file_path = RIGHT_CAP_BASELINE_FILE_PATH
    else:
        file_path = LEFT_CAP_BASE_LINE_FILE_PATH
    logger.debug(f'Loading cap baseline from: {file_path}')
    if os.path.isfile(file_path):
        with open(file_path, 'r') as json_file:
            baseline = json.load(json_file)
            json_file.close()
            return baseline
    else:
        raise FileNotFoundError(f'''Capacitance thresholds must be calibrated prior to running
Run `python3 calibrate_sensor_thresholds.py --side=right --start_time="2025-02-02 06:00:00" --end_time="2025-02-02 15:01:00"`
''')


def load_cap_df(data: Data, side: Side, expected_row_count=None) -> pd.DataFrame:
    logger.debug('Loading cap df...')
    df = pd.DataFrame(data['cap_senses'], columns=['ts', side])

    df[f'{side}_out'] = df[side].str['out']
    df[f'{side}_cen'] = df[side].str['cen']
    df[f'{side}_in'] = df[side].str['in']

    df.drop(columns=[side], inplace=True)

    # Sort, parse, set index in one pass
    df.sort_values('ts', inplace=True)
    df['ts'] = pd.to_datetime(df['ts'])
    df.set_index('ts', inplace=True)
    logger.debug(f'Capacitance rows loaded: {df.shape[0]:,}')
    if expected_row_count is not None:
        row_count = df.shape[0]
        if row_count / expected_row_count < 0.80:
            logger.warning(f'Potentially missing cap rows! Expected: {expected_row_count:,} Loaded: {row_count:,} ({row_count / expected_row_count * 100:0.0f}%)')

    logger.debug(f'Loaded cap df time range: {df.index[0]} -> {df.index[-1]}')
    return df


def detect_presence_cap(
        merged_df: pd.DataFrame,
        cap_baseline,
        side: Side,
        occupancy_threshold: int = 50,
        rolling_seconds=120,
        threshold_percent=0.75,
        clean=True
) -> pd.DataFrame:
    logger.debug('Detecting cap presence...')
    # Vectorized sensor deltas (removes the need for _sensor_delta row-wise function):
    merged_df[f'{side}_combined'] = (
            (merged_df[f'{side}_out'] - cap_baseline[f'{side}_out']['mean']) / cap_baseline[f'{side}_out']['std']
            + (merged_df[f'{side}_cen'] - cap_baseline[f'{side}_cen']['mean']) / cap_baseline[f'{side}_cen']['std']
            + (merged_df[f'{side}_in'] - cap_baseline[f'{side}_in']['mean']) / cap_baseline[f'{side}_in']['std']
    )

    merged_df[f'cap_{side}_occupied'] = (merged_df[f'{side}_combined'] > occupancy_threshold).astype(int)

    threshold_count = math.ceil(threshold_percent * rolling_seconds)

    # Rolling presence detection
    merged_df[f'cap_{side}_occupied'] = (
            merged_df[f'cap_{side}_occupied']
            .rolling(window=rolling_seconds, min_periods=1)
            .sum()
            >= threshold_count
    ).astype(int)

    logger.debug(f'Cap baseline for {side} side:')
    logger.debug(json.dumps(cap_baseline, indent=4))
    logger.debug(f'Presence df: \n{merged_df.describe()}')
    if clean:
        merged_df.drop(columns=[f'{side}_combined', f'{side}_out', f'{side}_cen', f'{side}_in'], inplace=True)
    return merged_df
