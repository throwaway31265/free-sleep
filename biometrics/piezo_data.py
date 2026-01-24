import gc
import math
import sys
import os
import pandas as pd
import numpy as np

sys.path.append(os.getcwd())
from data_types import *
from get_logger import get_logger

logger = get_logger()


def _calculate_avg(arr: np.ndarray):
    return np.mean(arr)


def load_piezo_df(data: Data, side: Side, lower_percentile=2, upper_percentile=98, expected_row_count=None) -> pd.DataFrame:
    logger.debug('Loading piezo df...')
    df = pd.DataFrame(data['piezo_dual'])
    df.sort_values(by='ts', inplace=True)
    df['ts'] = pd.to_datetime(df['ts'])
    df.set_index('ts', inplace=True)

    df[f'{side}1_avg'] = df[f'{side}1'].apply(_calculate_avg)

    lower_bound = np.percentile(df[f'{side}1_avg'], lower_percentile)
    upper_bound = np.percentile(df[f'{side}1_avg'], upper_percentile)
    df = df[(df[f'{side}1_avg'] >= lower_bound) & (df[f'{side}1_avg'] <= upper_bound)]

    df.drop(columns=[f'{side}1', 'type', 'freq', 'adc', 'gain'], inplace=True)
    logger.debug(f'Piezo rows loaded: {df.shape[0]:,}')
    if expected_row_count is not None:
        row_count = df.shape[0]
        if row_count / expected_row_count < 0.80:
            logger.warning(f'Potentially missing piezo rows! Expected: {expected_row_count:,} Loaded: {row_count:,} ({row_count / expected_row_count * 100:0.0f}%)')

    logger.debug(f'Loaded piezo df time range: {df.index[0]} -> {df.index[-1]}')
    return df


def detect_presence_piezo(df: pd.DataFrame, side: Side, rolling_seconds=10, threshold_percent=0.75, range_rolling_seconds=10, range_threshold=10_000,
                          clean=True):
    """Detects presence on a bed using piezo sensor data.

     The function determines when a person is present based on the sensor's range values.
     A rolling window approach is applied to check if the range exceeds a given threshold
     for a specified duration. Presence is marked when the threshold is met.

     Args:
         df (pd.DataFrame):
             The input DataFrame with a DatetimeIndex and columns `right1_avg` and `left1_avg` representing piezo sensor readings.
         rolling_seconds (int, optional):
             The duration (in seconds) for which presence is checked using a rolling sum. Defaults to 180.
         threshold_percent (float, optional):
             The percentage of time within `rolling_seconds` that the sensor range must exceed 10,000 to be considered present. Defaults to 0.75.
         range_rolling_seconds (int):
         clean (bool, optional):
             If True, drops intermediate computation columns from the DataFrame. Defaults to True.
     Returns:
         pd.DataFrame:
             The DataFrame with added `piezo_right1_presence` and `piezo_left1_presence` columns
             indicating presence (1) or absence (0) based on the rolling threshold.
     """
    logger.debug('Detecting piezo presence...')

    # Compute min/max range
    df[f'{side}1_min'] = df[f'{side}1_avg'].rolling(window=range_rolling_seconds, center=True).min()
    df[f'{side}1_max'] = df[f'{side}1_avg'].rolling(window=range_rolling_seconds, center=True).max()

    df[f'{side}1_range'] = df[f'{side}1_max'] - df[f'{side}1_min']

    # Apply presence detection
    df[f'piezo_{side}1_presence'] = (df[f'{side}1_range'] >= range_threshold).astype(int)

    threshold_count = math.ceil(threshold_percent * rolling_seconds)

    df[f"piezo_{side}1_presence"] = (
            df[f"piezo_{side}1_presence"]
            .rolling(window=range_rolling_seconds, min_periods=1)
            .sum()
            >= threshold_count
    ).astype(int)

    if clean:
        df.drop(
            columns=[
                f'{side}1_avg',
                f'{side}1_min',
                f'{side}1_max',
                f'{side}1_range',
            ],
            inplace=True
        )
    gc.collect()


def identify_baseline_period(merged_df: pd.DataFrame, side: str, threshold_range: int = 10_000, empty_minutes: int = 5):
    logger.debug('Finding baseline period...')
    merged_df = merged_df.sort_index()  # Ensure the index is sorted

    range_column = f'{side.lower()}1_range'
    stability_columns = [f'{side.lower()}_out', f'{side.lower()}_cen', f'{side.lower()}_in']

    # Iterate over time chunks (efficient early exit)
    window_size = pd.Timedelta(f'{empty_minutes}min')

    for start_time in merged_df.index:
        end_time = start_time + window_size

        # Ensure non-overlapping window
        window_df = merged_df.loc[(merged_df.index >= start_time) & (merged_df.index < end_time)]

        if len(window_df) == 0:
            continue  # Skip if no data

        # Condition 1: Max range values must be < threshold_range
        if window_df[range_column].max() >= threshold_range:
            continue

        # Condition 2: Std must be ≤ 5% of mean for stability columns
        rolling_std = window_df[stability_columns].std()
        rolling_mean = window_df[stability_columns].mean()

        # Handle division by zero
        ratio = np.where(rolling_mean != 0, rolling_std / rolling_mean, 0)

        if (ratio > 0.05).any():
            continue  # If any column exceeds the threshold, skip

        # If both conditions are met, return the first valid interval
        logger.debug(f"First valid interval: {start_time} to {end_time}")
        return start_time, end_time

    logger.debug("No valid baseline period found.")
    return None, None
