"""Regression tests for RAW loading; run with unittest discover -s biometrics/tests."""

import importlib.util
from io import BytesIO
from pathlib import Path
import queue
import struct
import sys
import tempfile
from datetime import datetime, timedelta, timezone
import unittest
from unittest.mock import Mock, patch

import cbor2
import numpy as np


biometrics_path = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(biometrics_path))

# Import the real readers without starting services, logging to disk, or using Sentry.
test_logger = Mock()
with patch.dict(sys.modules, {
    'get_logger': Mock(get_logger=Mock(return_value=test_logger)),
    'stream_processor': Mock(),
    'service_health': Mock(),
}):
    import load_raw_files
    from raw_records import read_raw_record

    stream_spec = importlib.util.spec_from_file_location(
        'raw_stream_under_test', biometrics_path / 'stream' / 'stream.py'
    )
    raw_stream = importlib.util.module_from_spec(stream_spec)
    stream_spec.loader.exec_module(raw_stream)


def wrap_payload(payload, sequence=1, reverse_keys=False):
    record = {'seq': sequence, 'data': payload}
    if reverse_keys:
        record = {'data': payload, 'seq': sequence}
    return cbor2.dumps(record)


def piezo_payload(timestamp, sensor_count=1):
    record = {'type': 'piezo-dual', 'ts': timestamp}
    for side in ['left', 'right']:
        for sensor in range(1, sensor_count + 1):
            record[f'{side}{sensor}'] = struct.pack('<iii', 10, -20, 30)
    return cbor2.dumps(record)


class RawRecordTests(unittest.TestCase):
    def test_all_sequence_widths_and_key_orders(self):
        for sequence in [0, 23, 24, 255, 256, 65535, 65536, 2**32, 2**64 - 1]:
            for reverse_keys in [False, True]:
                with self.subTest(sequence=sequence, reverse_keys=reverse_keys):
                    record = wrap_payload(b'payload', sequence, reverse_keys)
                    raw_file = BytesIO(record + wrap_payload(b'next'))
                    self.assertEqual(read_raw_record(raw_file), b'payload')
                    self.assertEqual(raw_file.tell(), len(record))
                    self.assertEqual(read_raw_record(raw_file), b'next')

    def test_payload_length_encodings(self):
        for length in [0, 1, 23, 24, 255, 256, 65535, 65536]:
            with self.subTest(length=length):
                payload = b'x' * length
                raw_file = BytesIO(wrap_payload(payload))
                self.assertEqual(read_raw_record(raw_file), payload or None)
        # Valid 64-bit length encoding with a small payload avoids huge allocations.
        raw_file = BytesIO(b'\xa2\x63seq\x01\x64data\x5b' + struct.pack('>Q', 2) + b'ok')
        self.assertEqual(read_raw_record(raw_file), b'ok')

    def test_indefinite_map_and_byte_string(self):
        raw_file = BytesIO(b'\xbf\x64data\x5f\x42ab\x42cd\xff\x63seq\x01\xff')
        self.assertEqual(read_raw_record(raw_file), b'abcd')

    def test_concatenated_records_do_not_read_ahead(self):
        for payload_size in [10, 2700, 5000]:
            with self.subTest(payload_size=payload_size), tempfile.TemporaryFile() as raw_file:
                payload = b'x' * payload_size
                records = [wrap_payload(payload, sequence) for sequence in range(100)]
                raw_file.write(b''.join(records))
                raw_file.seek(0)
                expected_position = 0
                for record in records:
                    self.assertEqual(read_raw_record(raw_file), payload)
                    expected_position += len(record)
                    self.assertEqual(raw_file.tell(), expected_position)
                with self.assertRaises(EOFError):
                    read_raw_record(raw_file)

    def test_every_partial_wrapper_raises_eof(self):
        record = wrap_payload(b'payload', 2**32)
        for split in range(len(record)):
            with self.subTest(split=split), self.assertRaises(EOFError):
                read_raw_record(BytesIO(record[:split]))

    def test_placeholder_and_missing_data(self):
        self.assertIsNone(read_raw_record(BytesIO(wrap_payload(b''))))
        self.assertIsNone(read_raw_record(BytesIO(cbor2.dumps({'seq': 1}))))

    def test_invalid_wrapper_types(self):
        for record in [[], 1, {'seq': 1, 'data': 'text'}, {'seq': 1, 'data': 4}]:
            with self.subTest(record=record), self.assertRaises(ValueError):
                read_raw_record(BytesIO(cbor2.dumps(record)))


class RawConsumerTests(unittest.TestCase):
    def setUp(self):
        test_logger.reset_mock()
        raw_stream.piezo_record_queue = queue.Queue()
        self.timestamp = int(datetime.now().timestamp())

    def create_handler(self, raw_file):
        handler = raw_stream.LatestRawFileHandler.__new__(raw_stream.LatestRawFileHandler)
        handler.latest_file_obj = raw_file
        handler.last_pos = 0
        return handler

    def test_stream_skips_placeholders_and_commits_filtered_records(self):
        records = [
            wrap_payload(piezo_payload(self.timestamp)),
            wrap_payload(b''),
            wrap_payload(cbor2.dumps({'type': 'log'})),
            wrap_payload(cbor2.dumps([])),
            wrap_payload(piezo_payload(self.timestamp - 600)),
        ]
        raw_file = BytesIO(b''.join(records))
        handler = self.create_handler(raw_file)
        handler.follow_latest_file()
        self.assertEqual(handler.last_pos, len(raw_file.getvalue()))
        self.assertEqual(raw_stream.piezo_record_queue.qsize(), 1)
        handler.follow_latest_file()
        self.assertEqual(raw_stream.piezo_record_queue.qsize(), 1)
        test_logger.error.assert_not_called()

    def test_stream_retries_every_partial_write_without_duplicates(self):
        first_record = wrap_payload(piezo_payload(self.timestamp))
        next_record = wrap_payload(piezo_payload(self.timestamp + 1, sensor_count=2))
        for split in range(len(next_record)):
            with self.subTest(split=split), tempfile.TemporaryFile() as raw_file:
                raw_stream.piezo_record_queue = queue.Queue()
                raw_file.write(first_record + next_record[:split])
                raw_file.seek(0)
                handler = self.create_handler(raw_file)
                handler.follow_latest_file()
                self.assertEqual(handler.last_pos, len(first_record))
                self.assertEqual(raw_file.tell(), len(first_record))
                self.assertEqual(raw_stream.piezo_record_queue.qsize(), 1)
                raw_file.seek(0, 2)
                raw_file.write(next_record[split:])
                raw_file.flush()
                handler.follow_latest_file()
                handler.follow_latest_file()
                self.assertEqual(handler.last_pos, len(first_record + next_record))
                self.assertEqual(raw_stream.piezo_record_queue.qsize(), 2)
        test_logger.error.assert_not_called()

    def test_stream_skips_bad_payloads_and_reaches_next_record(self):
        raw_file = BytesIO(b''.join([
            wrap_payload(b'\xa1'),  # Complete wrapper, truncated inner CBOR.
            wrap_payload(b'\x1c'),  # Invalid additional-information value.
            wrap_payload(cbor2.dumps({'type': 'piezo-dual'})),
            wrap_payload(piezo_payload(self.timestamp)),
        ]))
        handler = self.create_handler(raw_file)
        handler.follow_latest_file()
        self.assertEqual(raw_stream.piezo_record_queue.qsize(), 1)
        self.assertEqual(handler.last_pos, len(raw_file.getvalue()))
        self.assertEqual(test_logger.error.call_count, 3)

    def test_stream_rewinds_bad_outer_wrapper_to_last_boundary(self):
        first_record = wrap_payload(piezo_payload(self.timestamp))
        raw_file = BytesIO(first_record + b'\xff')
        handler = self.create_handler(raw_file)
        handler.follow_latest_file()
        self.assertEqual(handler.last_pos, len(first_record))
        self.assertEqual(raw_file.tell(), len(first_record))
        handler.follow_latest_file()
        self.assertEqual(raw_stream.piezo_record_queue.qsize(), 1)

    def test_stream_rotates_to_new_file(self):
        with tempfile.TemporaryDirectory() as directory:
            first_file = Path(directory) / 'first.RAW'
            first_file.write_bytes(wrap_payload(piezo_payload(self.timestamp)))
            handler = raw_stream.LatestRawFileHandler(directory)
            try:
                handler.follow_latest_file()
                first_handle = handler.latest_file_obj
                next_file = Path(directory) / 'second.RAW'
                next_file.write_bytes(wrap_payload(piezo_payload(self.timestamp + 1)))
                with patch.object(raw_stream, '_safe_getmtime', side_effect=lambda path: 2 if path.endswith('second.RAW') else 1):
                    handler.track_latest_file()
                self.assertTrue(first_handle.closed)
                self.assertEqual(handler.last_pos, 0)
                handler.follow_latest_file()
                self.assertEqual(raw_stream.piezo_record_queue.qsize(), 2)
            finally:
                handler.latest_file_obj.close()

    def test_historical_loading_keeps_single_and_dual_sensor_data(self):
        start_time = datetime.fromtimestamp(self.timestamp, timezone.utc) - timedelta(seconds=1)
        end_time = start_time + timedelta(minutes=15)
        for sensor_count in [1, 2]:
            for side in ['left', 'right']:
                with self.subTest(sensor_count=sensor_count, side=side), tempfile.TemporaryDirectory() as directory:
                    raw_file = Path(directory) / 'sample.RAW'
                    raw_file.write_bytes(b''.join([
                        wrap_payload(b''),
                        wrap_payload(b'\xa1'),
                        wrap_payload(cbor2.dumps([])),
                        wrap_payload(piezo_payload(self.timestamp, sensor_count)),
                        wrap_payload(cbor2.dumps({'type': 'capSense', 'ts': self.timestamp, 'left': {}, 'right': {}})),
                        wrap_payload(b''),
                        wrap_payload(piezo_payload(self.timestamp + 1, sensor_count)),
                    ]))
                    result = load_raw_files.load_raw_files(
                        directory, start_time, end_time, side, sensor_count, ['piezo-dual', 'capSense']
                    )
                    self.assertEqual(len(result['piezo_dual']), 2)
                    self.assertEqual(len(result['cap_senses']), 1)
                    self.assertIn(side, result['cap_senses'][0])
                    for record in result['piezo_dual']:
                        self.assertEqual(len(record), 2 + sensor_count)
                        for sensor in range(1, sensor_count + 1):
                            np.testing.assert_array_equal(record[f'{side}{sensor}'], [10, -20, 30])

    def test_historical_loading_stops_on_partial_or_bad_wrapper(self):
        start_time = datetime.fromtimestamp(self.timestamp, timezone.utc) - timedelta(seconds=1)
        for suffix in [b'\xa2', b'\xff']:
            with self.subTest(suffix=suffix), tempfile.TemporaryDirectory() as directory:
                raw_file = Path(directory) / 'sample.RAW'
                raw_file.write_bytes(wrap_payload(piezo_payload(self.timestamp)) + suffix)
                data = {'piezo-dual': []}
                load_raw_files._decode_cbor_file(
                    str(raw_file), data, start_time, start_time + timedelta(minutes=15), 'right', 1
                )
                self.assertEqual(len(data['piezo-dual']), 1)


if __name__ == '__main__':
    unittest.main()
