import struct
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


def _read_raw_record(f):
    """
    Manually parse one outer {seq, data} CBOR record using f.read().

    The cbor2 C extension (_cbor2) reads files in internal 4096-byte chunks,
    so cbor2.load(f) advances f.tell() by 4096 bytes regardless of the actual
    record size. Since RAW file records are typically 17-5000 bytes, this causes
    nearly every record to be skipped silently.

    This function parses the outer {seq: uint, data: bytes} wrapper byte-by-byte
    using f.read(), keeping f.tell() accurate after each record.

    Returns the raw inner data bytes, or None for empty placeholder records
    (which the Pod firmware writes as sequence number markers with data=b'').
    Raises EOFError at end of file, ValueError on malformed data.
    """
    b = f.read(1)
    if not b:
        raise EOFError
    if b[0] != 0xa2:
        raise ValueError('Expected outer map 0xa2, got 0x%02x' % b[0])
    if f.read(4) != b'\x63\x73\x65\x71':
        raise ValueError('Expected seq key')
    hdr = f.read(1)
    if not hdr:
        raise EOFError
    if hdr[0] == 0x1a:
        seq_bytes = f.read(4)
        if len(seq_bytes) < 4:
            raise EOFError
    elif hdr[0] == 0x1b:
        seq_bytes = f.read(8)
        if len(seq_bytes) < 8:
            raise EOFError
    else:
        raise ValueError('Unexpected seq encoding: 0x%02x' % hdr[0])
    if f.read(5) != b'\x64\x64\x61\x74\x61':
        raise ValueError('Expected data key')
    bs = f.read(1)
    if not bs:
        raise EOFError
    ai = bs[0] & 0x1f
    if ai <= 23:
        length = ai
    elif ai == 24:
        lb = f.read(1)
        if not lb:
            raise EOFError
        length = lb[0]
    elif ai == 25:
        lb = f.read(2)
        if len(lb) < 2:
            raise EOFError
        length = struct.unpack('>H', lb)[0]
    elif ai == 26:
        lb = f.read(4)
        if len(lb) < 4:
            raise EOFError
        length = struct.unpack('>I', lb)[0]
    else:
        raise ValueError('Unsupported length encoding: %d' % ai)
    data = f.read(length)
    if len(data) < length:
        raise EOFError
    if not data:
        return None  # empty placeholder record, caller should skip
    return data


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

                # Use manual reader instead of cbor2.load() to avoid the cbor2
                # C extension reading in 4096-byte chunks, which causes it to
                # skip most records regardless of their actual size.
                data_bytes = _read_raw_record(raw_data)
                if data_bytes is None:
                    continue  # empty placeholder record
                decoded_data = cbor2.loads(data_bytes)
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
                            raw_data.close()
                            return

                if decoded_data['type'] == 'piezo-dual':
                    load_piezo_row(decoded_data, side)

                decoded_data['ts'] = datetime.fromtimestamp(
                    decoded_data['ts'],
                    timezone.utc
                ).strftime("%Y-%m-%d %H:%M:%S")
                data[decoded_data['type']].append(decoded_data)

            except EOFError:
                break
            except Exception as error:
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
