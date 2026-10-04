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
import tempfile
import pandas as pd
from datetime import datetime
from data_types import *
from get_logger import get_logger
from capacitance import CAP_CHANNELS, CapacitanceFormat, LEGACY_CAP_FORMAT, get_capacitance_format

logger = get_logger()

LEFT_CAP_BASE_LINE_FILE_PATH = f'{logger.folder_path}left_cap_baseline.json'
RIGHT_CAP_BASELINE_FILE_PATH = f'{logger.folder_path}right_cap_baseline.json'
pd.set_option('display.width', 300)
pd.set_option('display.max_columns', 50)


def create_cap_baseline_from_cap_df(
        merged_df: pd.DataFrame, start_time: datetime, end_time: datetime, side: Side,
        min_std: float = None, cap_format: CapacitanceFormat = LEGACY_CAP_FORMAT
) -> CapBaseline:
    """Calibrate in the source format's units and reject incomplete baseline windows."""
    if start_time is None or end_time is None:
        raise ValueError('No stable capacitance baseline period found; record at least five minutes of empty bed.')
    if min_std is None:
        min_std = cap_format.min_std
    if not math.isfinite(min_std) or min_std <= 0:
        raise ValueError('The capacitance noise floor must be positive and finite.')
    logger.debug(f'Creating baseline for capacitance sensors...')
    filtered_df = merged_df[start_time:end_time]
    logger.debug(f'filtered_df: \n{filtered_df.describe()}')
    cap_baseline = {}
    for sensor in [f'{side}_out', f'{side}_cen', f'{side}_in']:
        cap_baseline[sensor] = {
            "mean": filtered_df[sensor].mean(),
            "std": max(filtered_df[sensor].std(), min_std)
        }

    _validate_baseline(cap_baseline, side)
    logger.debug(f'cap_baseline: \n{json.dumps(cap_baseline, indent=4)}')
    return cap_baseline


def _validate_baseline(baseline: dict, side: Side):
    """Invalid calibration must never replace a working baseline or reach detection."""
    try:
        valid = all(
            math.isfinite(baseline[f'{side}_{sensor}']['mean'])
            and math.isfinite(baseline[f'{side}_{sensor}']['std'])
            and baseline[f'{side}_{sensor}']['std'] > 0
            for sensor in CAP_CHANNELS
        )
    except (KeyError, TypeError, ValueError):
        valid = False
    if not valid:
        raise ValueError(f'Invalid {side} capacitance baseline; recalibrate with sufficient valid empty-bed data.')


def save_baseline(side: Side, cap_baseline: dict, cap_format: CapacitanceFormat = LEGACY_CAP_FORMAT):
    """Keep legacy JSON compatible and tag Pod 5 baselines before replacing the file."""
    _validate_baseline(cap_baseline, side)
    if side == 'right':
        file_path = RIGHT_CAP_BASELINE_FILE_PATH
    else:
        file_path = LEFT_CAP_BASE_LINE_FILE_PATH
    logger.debug(f'Saving {side} side cap_baseline to {file_path}')

    saved_baseline = cap_baseline
    if cap_format != LEGACY_CAP_FORMAT:
        saved_baseline = {'format': cap_format.name, 'version': cap_format.version, 'channels': cap_baseline}

    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', dir=os.path.dirname(file_path), delete=False) as json_file:
            temporary_path = json_file.name
            json.dump(saved_baseline, json_file, indent=4, allow_nan=False)
        os.replace(temporary_path, file_path)
    finally:
        if temporary_path is not None and os.path.exists(temporary_path):
            os.unlink(temporary_path)


def load_baseline(side: Side, cap_format: CapacitanceFormat = LEGACY_CAP_FORMAT):
    """Read old baseline files as legacy only; require matching Pod 5 format metadata."""
    if side == 'right':
        file_path = RIGHT_CAP_BASELINE_FILE_PATH
    else:
        file_path = LEFT_CAP_BASE_LINE_FILE_PATH
    logger.debug(f'Loading cap baseline from: {file_path}')
    if os.path.isfile(file_path):
        with open(file_path, 'r') as json_file:
            baseline = json.load(json_file)
        if not isinstance(baseline, dict):
            raise ValueError(f'Invalid {side} capacitance baseline; recalibrate sensors.')
        if 'format' in baseline:
            saved_format = (baseline.get('format'), baseline.get('version'))
            baseline = baseline.get('channels')
        else:
            saved_format = (LEGACY_CAP_FORMAT.name, LEGACY_CAP_FORMAT.version)
        if saved_format != (cap_format.name, cap_format.version):
            raise ValueError(f'Capacitance baseline does not match {cap_format.name}; recalibrate the {side} side.')
        _validate_baseline(baseline, side)
        return baseline
    else:
        raise FileNotFoundError(f'''Capacitance thresholds must be calibrated prior to running
Run `python3 calibrate_sensor_thresholds.py --side=right --start_time="2025-02-02 06:00:00" --end_time="2025-02-02 15:01:00"`
''')


def load_cap_df(data: Data, side: Side, expected_row_count=None) -> pd.DataFrame:
    """Load legacy rows unchanged; average valid Pod 5 readings within each second."""
    logger.debug('Loading cap df...')
    records = data['cap_senses']
    if not records:
        raise ValueError(f'No usable capacitance data for the {side} side in the requested time window.')
    cap_format = get_capacitance_format(records)
    frame = pd.DataFrame(records, columns=['ts', side])
    sensor_columns = [f'{side}_{sensor}' for sensor in CAP_CHANNELS]
    for sensor, column in zip(CAP_CHANNELS, sensor_columns):
        frame[column] = frame[side].str[sensor]
    frame.drop(columns=[side], inplace=True)

    # Sort, parse, set index in one pass
    frame.sort_values('ts', inplace=True)
    frame['ts'] = pd.to_datetime(frame['ts'])
    frame.set_index('ts', inplace=True)
    if cap_format != LEGACY_CAP_FORMAT:
        invalid_rows = frame[sensor_columns].isna().any(axis=1)
        if invalid_rows.any():
            logger.warning(f'Skipping {invalid_rows.sum()} invalid {side} {cap_format.name} readings.')
        frame = frame.loc[~invalid_rows]
        # capSense2 can contain two readings with the same integer timestamp.
        frame = frame.groupby(frame.index.floor('s')).mean(numeric_only=True)
    if frame.empty:
        raise ValueError(f'No usable capacitance data for the {side} side in the requested time window.')
    frame.attrs['cap_format'] = cap_format
    logger.debug(f'Capacitance rows loaded: {frame.shape[0]:,}')
    if expected_row_count is not None and expected_row_count > 0:
        row_count = frame.shape[0]
        if row_count / expected_row_count < 0.80:
            logger.warning(f'Potentially missing cap rows! Expected: {expected_row_count:,} Loaded: {row_count:,} ({row_count / expected_row_count * 100:0.0f}%)')

    logger.debug(f'Loaded cap df time range: {frame.index[0]} -> {frame.index[-1]}')
    return frame


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
