import numpy as np
import traceback
from datetime import datetime, timedelta, timezone
import cbor2
from pathlib import Path
import gc
import sys
import os

# Add the current directory to sys.path
sys.path.append(os.getcwd())
from data_types import *
from get_logger import get_logger

logger = get_logger()


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
            if del_side in decoded_data:
                del decoded_data[del_side]
        else:
            if sensor_count == 1:
                # Delete sensor 2 of the current side
                if f'{side}2' in decoded_data:
                    del decoded_data[f'{side}2']
            # Delete opposite side
            if f'{del_side}1' in decoded_data:
                del decoded_data[f'{del_side}1']
            if f'{del_side}2' in decoded_data:
                del decoded_data[f'{del_side}2']
    except Exception as error:
        logger.error(error)
        traceback.print_exc()
        print(decoded_data)
        raise error


def _iter_raw_records(f):
    """
    Generator that yields valid Outer Records from the file.
    Handles resyncing if corruption is encountered.
    """
    header = b'\xa2\x63\x73\x65\x71\x1a'
    while True:
        pos = f.tell()
        try:
            row = cbor2.load(f)
            if isinstance(row, dict) and 'data' in row:
                yield row
            else:
                # Not a valid record, force a resync from next byte
                f.seek(pos + 1)
                raise ValueError("Invalid record format")
        except (EOFError, StopIteration):
            break
        except Exception as error:
            logger.debug(f"Framing error at byte {pos}: {error}. Resyncing...")
            # Resync: search for the next occurrence of the row header
            chunk_size = 4096
            found = False
            while True:
                current_pos = f.tell()
                chunk = f.read(chunk_size)
                if not chunk:
                    break
                
                idx = chunk.find(header)
                if idx != -1:
                    raw_pos = current_pos + idx
                    f.seek(raw_pos)
                    logger.debug(f"Resynced framing at byte {raw_pos}")
                    found = True
                    break
            
            if not found:
                break


def _decode_cbor_file(file_path: str, data: dict, start_time, end_time, side: Side, sensor_count: int):
    # logger.debug(f'Loading cbor data from: {file_path}')
    load_raw_types = list(data.keys())
    checked_timespan = False
    
    with open(file_path, 'rb') as f:
        for row in _iter_raw_records(f):
            try:
                # Each outer record's 'data' field may contain multiple CBOR objects
                # or a partial object (though usually it's whole objects in this format)
                import io
                stream = io.BytesIO(row['data'])
                
                while True:
                    try:
                        decoded_data = cbor2.load(stream)
                        if not isinstance(decoded_data, dict) or 'type' not in decoded_data:
                            continue

                        if not decoded_data['type'] in load_raw_types:
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
                                    # Still outside range, but might find it in next record
                                    continue

                        if decoded_data['type'] == 'piezo-dual':
                            load_piezo_row(decoded_data, side)

                        decoded_data['ts'] = datetime.fromtimestamp(
                            decoded_data['ts'],
                            timezone.utc
                        ).strftime("%Y-%m-%d %H:%M:%S")
                        data[decoded_data['type']].append(decoded_data)

                    except EOFError:
                        # Finished reading objects from this outer record
                        break
                    except Exception as inner_error:
                        logger.warning(f"Error decoding inner object in record {row.get('seq')}: {inner_error}")
                        # If inner decoding fails, we skip to the NEXT outer record
                        break

            except Exception as error:
                logger.error(f"Unexpected error processing outer record: {error}")
        
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
