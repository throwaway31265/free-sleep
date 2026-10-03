import numpy as np
import traceback
from datetime import datetime, timedelta, timezone
import cbor2
from pathlib import Path
import gc
import sys
import os
import asyncio
import socket
import nats
from nats.js.api import ConsumerConfig, DeliverPolicy

# Add the current directory to sys.path
sys.path.append(os.getcwd())
from data_types import *
from get_logger import get_logger
from raw_records import read_raw_record

logger = get_logger()


# Mapping old payload key strings to the new NATS subjects
# A list of data streams can be found with 'nats stream subjects raw'
# raw.log, raw.frz.health, raw.sens.health, raw.frz.temp, raw.sens.bedtemp,
# raw.sens.piezo, raw.sens.piezo, raw.frz.therm, raw.sens.capsense
SUBJECT_MAP = {
    'bedTemp': 'raw.sens.bedtemp',
    'capSense': 'raw.sens.capsense',
    'frzTemp': 'raw.frz.temp',
    'log': 'raw.log',
    'piezo-dual': 'raw.sens.piezo'
}


def is_nats_running(host="127.0.0.1", port=4222, timeout=2):
    """Checks if NATS server is active on localhost."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except (ConnectionRefusedError, TimeoutError, OSError):
        return False


async def _fetch_jetstream_historical_data(start_time: datetime, end_time: datetime, raw_data_types: list, side: Side, sensor_count: int) -> dict:
    """Connects to JetStream and fetches historical messages inside the time window."""
    nc = None
    # Initialize dictionary keys exactly matching raw_data_types (e.g. 'piezo-dual', 'capSense' for analyze sleep)
    extracted_data = {field: [] for field in raw_data_types}
        
    try:
        # Connect to the NATS JetStream Server to request data logs
        nc = await nats.connect("nats://127.0.0.1:4222")
        js = nc.jetstream()

        for field in raw_data_types:
            subject = SUBJECT_MAP.get(field)
            if not subject:
                continue
            
            try:
                # Request logs for the data type using the start time provided
                sub = await js.subscribe(
                    subject, 
                    stream="raw", 
                    config=ConsumerConfig(
                        deliver_policy=DeliverPolicy.BY_START_TIME,
                        opt_start_time=start_time
                    )
                )

                while True:
                    try:
                        msg = await sub.next_msg(timeout=0.5)
                        decoded_record = cbor2.loads(msg.data)
                        if 'ts' in decoded_record:
                            # Stop grabbing records once we hit the end_time
                            raw_ts = datetime.fromtimestamp(decoded_record['ts'], timezone.utc)
                            if raw_ts >= end_time:
                                break 
                        # This only uses 1 sensor count during analyze sleep, which avoids an issue with dropping dumplicates in sleep_detector.
                        # Numpy should probably drop duplicate ndarrays instead of pandas failing on it.
                        # Ideally we should also filter out the other side instead of adding it in the first place.
                        _delete_other_side(decoded_record, side, sensor_count)
                        if field == 'piezo-dual':
                            # Load only the side we're checking and process it
                            load_piezo_row(decoded_record, side)

                        # Adjust timestamp in the same way as the legacy pipeline
                        decoded_record['ts'] = datetime.fromtimestamp(
                                            decoded_record['ts'],
                                            timezone.utc
                                        ).strftime("%Y-%m-%d %H:%M:%S")
                        extracted_data[field].append(decoded_record)
                        await msg.ack()

                    except asyncio.TimeoutError:
                        break
            except Exception as sub_err:
                logger.error(f"Failed to fetch JetStream data for {field}: {sub_err}")
                
    except Exception as err:
        logger.error(f"NATS Connection error inside load_raw_files: {err}")
    finally:
        if nc is not None and nc.is_connected:
            await nc.close()
            
    return extracted_data


def get_current_files(folder_path: str):
    return [
        str(f.resolve())
        for f in Path(folder_path).glob('*.RAW')
        if f.is_file() and f.name != 'SEQNO.RAW'
    ]


def _decode_piezo_data(raw_bytes: bytes) -> np.ndarray:
    return np.frombuffer(raw_bytes, dtype=np.int32)


def load_piezo_row(data: dict, side: Side):
    # if side == 'left':
    if 'left1' in data:
        data['left1'] = _decode_piezo_data(data['left1'])
    if 'left2' in data:
        data['left2'] = _decode_piezo_data(data['left2'])
    # else:
    if 'right1' in data:
        data['right1'] = _decode_piezo_data(data['right1'])
    if 'right2' in data:
        data['right2'] = _decode_piezo_data(data['right2'])


def _delete_other_side(decoded_data: dict, side: Side, sensor_count: int):
    """
    Delete other sides data for saving memory space
    """
    try:
        del_side = 'left'
        if side == 'left':
            del_side = 'right'

        if decoded_data['type'] == 'capSense':
            del decoded_data[del_side]
        else:
            if sensor_count == 1:
                # Delete sensor 2 of the current side
                if f'{side}2' in decoded_data:
                    del decoded_data[f'{side}2']
            # Delete opposite side
            del decoded_data[f'{del_side}1']
            if f'{del_side}2' in decoded_data:
                del decoded_data[f'{del_side}2']
    except Exception as error:
        logger.error(error)
        traceback.print_exc()
        print(decoded_data)
        raise error


def _decode_cbor_file(file_path: str, data: dict, start_time, end_time, side: Side, sensor_count: int):
    # logger.debug(f'Loading cbor data from: {file_path}')
    load_raw_types = list(data.keys())
    checked_timespan = False
    with open(file_path, 'rb') as raw_data:
        while True:
            try:
                payload = read_raw_record(raw_data)
            except EOFError:
                # read_raw_record normalizes partial CBOR wrappers to EOFError.
                break
            except Exception as error:
                # A damaged wrapper has no reliable boundary for the next record.
                logger.error(error)
                break

            if payload is None:
                continue

            try:
                decoded_data = cbor2.loads(payload)
                if not isinstance(decoded_data, dict) or decoded_data.get('type') not in load_raw_types:
                    continue
                _delete_other_side(decoded_data, side, sensor_count)
                if not checked_timespan:
                    timestamp_start = datetime.fromtimestamp(
                        decoded_data['ts'],
                        timezone.utc
                    )
                    timestamp_end = timestamp_start + timedelta(minutes=15)
                    if start_time <= timestamp_start <= end_time:
                        checked_timespan = True
                    else:
                        if start_time <= timestamp_end <= end_time:
                            checked_timespan = True
                        else:
                            raw_data.close()
                            return

                if decoded_data['type'] == 'piezo-dual':
                    load_piezo_row(decoded_data, side)

                decoded_data['ts'] = datetime.fromtimestamp(
                    decoded_data['ts'],
                    timezone.utc
                ).strftime("%Y-%m-%d %H:%M:%S")
                data[decoded_data['type']].append(decoded_data)

            except Exception as error:
                # The wrapper was complete, so a bad payload can be skipped safely.
                logger.error(error)
        raw_data.close()
        gc.collect()
    return data


def _rename_keys(data: dict):
    key_mapping = {
        'log': 'logs',
        'piezo-dual': 'piezo_dual',
        'capSense': 'cap_senses',
        'frzTemp': 'freeze_temps',
        'bedTemp': 'bed_temps',
    }
    for old_key, new_key in key_mapping.items():
        if old_key in data:
            data[new_key] = data.pop(old_key)


def _debug_data(data: dict):
    for key in data:
        if isinstance(data[key], list) and len(data[key]) > 0:
            logger.info(f'{key} - {data[key][0]}')
        elif not isinstance(data[key], list):
            logger.warning(f'Unexpected type for loading raw file {type(data[key])}')


def load_raw_files(folder_path: str, start_time: datetime, end_time: datetime, side: Side, sensor_count=2, raw_data_types: List[RawDataTypes] = None):
    try:
        data = {}
        if raw_data_types is None:
            raw_data_types = ['bedTemp', 'capSense', 'frzTemp', 'log', 'piezo-dual']

        # If NATS is running we grab data from JetStream records stored in /persistent/jetstream
        if is_nats_running():
            logger.info("NATS detected! Fetching data from JetStream store...")
            data = asyncio.run(_fetch_jetstream_historical_data(start_time, end_time, raw_data_types, side, sensor_count))
            logger.info("Data fetched from JetStream store successfully.")
        else:
            for field in raw_data_types:
                data[field] = []
            logger.info(f'Loading RAW files from {folder_path} | {start_time.isoformat()} -> {end_time.isoformat()}')

            file_paths = get_current_files(folder_path)

            if len(file_paths) == 0:
                logger.error('No file paths detected!')
                raise FileNotFoundError(f'No files found for: {folder_path}! Is internet blocked?')

            for file_path in file_paths:
                if os.path.isfile(file_path):
                    _decode_cbor_file(file_path, data, start_time, end_time, side, sensor_count)
                else:
                    logger.warning(f'File path deleted before parsed! {file_path}')

        _rename_keys(data)
        data_found = False
        for key in data.keys():
            if len(data[key]) > 0:
                data_found = True
            logger.debug(f"{key} - Rows found: {len(data[key])}")

        if not data_found:
            logger.warning('No data found! Mattress topper may be disconnected!')
        gc.collect()
        _debug_data(data)

        return data
    except Exception as error:
        logger.error(error)
        _debug_data(data)

        raise error
