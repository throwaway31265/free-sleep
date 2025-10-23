from datetime import datetime
from typing import List
import atexit
import json
import math
import numpy as np
import pandas as pd
import sqlite3

from data_types import *
from get_logger import *

logger = get_logger()

DB_FILE_PATH = f'{logger.folder_path}free-sleep.db'

# Create a persistent connection
conn = sqlite3.connect(DB_FILE_PATH, isolation_level=None, check_same_thread=False)
conn.execute("PRAGMA journal_mode=WAL;")  # Enable WAL mode
conn.execute("PRAGMA busy_timeout=5000;")  # Wait up to 5 seconds if locked
cursor = conn.cursor()
atexit.register(lambda: conn.close())


def custom_serializer(obj):
    if isinstance(obj, (datetime, pd.Timestamp)):
        return obj.isoformat()  # Convert to ISO 8601 format
    raise TypeError(f"Type {type(obj)} not serializable")


def convert_timestamps(data: List[SleepRecord]) -> List[SleepRecord]:
    formatted_data = []
    for entry in data:
        formatted_entry: SleepRecord = {
            "side": entry["side"],
            "entered_bed_at": datetime.fromisoformat(entry["entered_bed_at"]),
            "left_bed_at": datetime.fromisoformat(entry["left_bed_at"]),
            "sleep_period_seconds": entry["sleep_period_seconds"],
            "times_exited_bed": entry["times_exited_bed"],
            "present_intervals": [
                (datetime.fromisoformat(start), datetime.fromisoformat(end))
                for start, end in entry["present_intervals"]
            ],
            "not_present_intervals": [
                (datetime.fromisoformat(start), datetime.fromisoformat(end))
                for start, end in entry["not_present_intervals"]
            ]
        }
        formatted_data.append(formatted_entry)
    return formatted_data


def insert_vitals(data: dict):
    """
    Inserts a record into the 'vitals' table. If a conflict occurs, it skips the insertion.
    """
    sql = """
    INSERT INTO vitals (side, timestamp, heart_rate, hrv, breathing_rate)
    VALUES (:side, :timestamp, :heart_rate, :hrv, :breathing_rate)
    ON CONFLICT(side, timestamp) DO NOTHING;
    """
    if np.isnan(data['hrv']):
        data['hrv'] = 0
    else:
        data['hrv'] = math.floor(data['hrv'])

    if np.isnan(data['breathing_rate']):
        data['breathing_rate'] = 0
    else:
        data['breathing_rate'] = math.floor(data['breathing_rate'])

    data['heart_rate'] = math.floor(data['heart_rate'])
    logger.debug('Inserting vitals record...')
    try:
        cursor.execute(sql, data)
        conn.commit()
    except sqlite3.Error as e:
        error_message = traceback.format_exc()
        logger.error(e)
        logger.error(error_message)


def insert_sleep_records(sleep_records: List[SleepRecord]):
    """
    Inserts a list of records into the sleep_records table in the given database.
    Each record is expected to have:
      - side (str)
      - entered_bed_at (datetime)
      - left_bed_at (datetime, optional)
      - sleep_period_seconds (int)
      - times_exited_bed (int)
      - present_intervals (list of [start, end] datetime pairs)
      - not_present_intervals (list of [start, end] datetime pairs)
    """
    if len(sleep_records) == 0:
        logger.warning(f'No sleep records to insert, exiting...')
        return
    else:
        logger.info(f'Inserting {len(sleep_records)} sleep record(s) into {DB_FILE_PATH}...')
        logger.info(json.dumps(sleep_records, indent=4, default=custom_serializer))

    conn = sqlite3.connect(DB_FILE_PATH)
    cur = conn.cursor()
    insert_query = """
    INSERT OR IGNORE INTO sleep_records (
        side,
        entered_bed_at,
        left_bed_at,
        sleep_period_seconds,
        times_exited_bed,
        present_intervals,
        not_present_intervals
    ) VALUES (?, ?, ?, ?, ?, ?, ?);
    """

    # Convert records to tuples for insertion
    values_to_insert = []
    for sleep_record in sleep_records:
        side = sleep_record['side']
        entered_bed_at = int(sleep_record['entered_bed_at'].timestamp())
        left_bed_at = int(sleep_record.get('left_bed_at').timestamp())
        sleep_period_seconds = sleep_record.get('sleep_period_seconds', 0)
        times_exited_bed = sleep_record.get('times_exited_bed', 0)

        # Encode intervals as JSON strings
        present_intervals_str = json.dumps([
            [int(start.timestamp()), int(end.timestamp())] for start, end in sleep_record.get('present_intervals', [])
        ])
        not_present_intervals_str = json.dumps([
            [int(start.timestamp()), int(end.timestamp())] for start, end in sleep_record.get('not_present_intervals', [])
        ])

        # Prepare the data tuple
        row_tuple = (
            side,
            entered_bed_at,
            left_bed_at,
            sleep_period_seconds,
            times_exited_bed,
            present_intervals_str,
            not_present_intervals_str
        )
        values_to_insert.append(row_tuple)

    cur.executemany(insert_query, values_to_insert)
    conn.commit()
    cur.close()
    conn.close()
    logger.info(f"Inserted {len(sleep_records)} record(s) into 'sleep_records' (ignoring duplicates).")


def insert_movement_df(movement_df: pd.DataFrame):
    logger.debug(f'Inserting {movement_df.shape[0]} rows into movement table...')
    movement_df['timestamp'] = pd.to_datetime(movement_df['timestamp']).astype(int) // 10 ** 9

    # Upload to SQLite
    with sqlite3.connect(DB_FILE_PATH) as conn:
        movement_df.to_sql("movement", conn, if_exists='append', index=False)

    logger.debug('Finished inserting rows')

