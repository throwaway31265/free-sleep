"""Regression coverage for legacy and Pod 5 capacitance loading and calibration."""

import asyncio
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import struct
import sys
import tempfile
import unittest
from unittest.mock import AsyncMock, Mock, patch

import cbor2
import nats
import numpy as np
import pandas as pd

biometrics_path = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(biometrics_path))

from capacitance import LEGACY_CAP_FORMAT, POD5_CAP_FORMAT, normalize_capacitance_record

test_logger = Mock(folder_path='/unused/')
with patch.dict(sys.modules, {
    'get_logger': Mock(get_logger=Mock(return_value=test_logger)),
    'service_health': Mock(),
    'db': Mock(),
}):
    import load_raw_files
    from sleep_detection import cap_data, sleep_detector
    from piezo_data import identify_baseline_period
    # The CLI imports cap_data by its script-local name.
    with patch.dict(sys.modules, {'cap_data': cap_data}):
        from sleep_detection import calibrate_sensor_thresholds as calibration


TIMESTAMP = 1761860556


def cap_record(cap_format=POD5_CAP_FORMAT, timestamp=TIMESTAMP, offset=0):
    record = {'type': cap_format.name, 'ts': timestamp}
    if cap_format == POD5_CAP_FORMAT:
        record['version'] = 1
    for side in ('left', 'right'):
        if cap_format == POD5_CAP_FORMAT:
            record[side] = {'values': [value + offset for value in (12, 14, 16, 18, 20, 22, 1, 1)], 'status': 'good'}
        else:
            record[side] = {'out': 400 + offset, 'cen': 500 + offset, 'in': 600 + offset, 'status': 'good'}
    return record


def wrap_record(record):
    return cbor2.dumps({'seq': 1, 'data': cbor2.dumps(record)})


def cap_frame(records, side='left'):
    # Match the loader's UTC timestamp strings at the dataframe boundary.
    normalized = [
        {**normalize_capacitance_record(record),
         'ts': datetime.fromtimestamp(record['ts'], timezone.utc).strftime('%Y-%m-%d %H:%M:%S')}
        for record in records
    ]
    return cap_data.load_cap_df({'cap_senses': normalized}, side)


class CapacitanceFormatTests(unittest.TestCase):
    def test_legacy_record_is_unchanged(self):
        record = cap_record(LEGACY_CAP_FORMAT)
        original = deepcopy(record)
        self.assertIs(normalize_capacitance_record(record), record)
        self.assertEqual(record, original)

    def test_pod5_pairs_are_normalized_without_mutating_input(self):
        record = cap_record()
        original = deepcopy(record)
        normalized = normalize_capacitance_record(record)
        self.assertEqual(record, original)
        self.assertEqual(normalized['type'], 'capSense')
        self.assertEqual(normalized['cap_format'], 'capSense2')
        self.assertEqual(normalized['version'], 1)
        for side in ('left', 'right'):
            self.assertEqual(normalized[side], {'out': 13, 'cen': 17, 'in': 21, 'status': 'good'})

    def test_unknown_versions_are_rejected(self):
        for version in (None, 2, True, 1.0, '1'):
            with self.subTest(version=version):
                record = cap_record()
                record['version'] = version
                with self.assertRaisesRegex(ValueError, 'Unsupported capSense2 version'):
                    normalize_capacitance_record(record)

    def test_invalid_side_does_not_discard_other_side(self):
        bad_channels = [None, {}, {'status': 'bad', 'values': [1] * 8}]
        bad_channels += [{'status': 'good', 'values': values} for values in (None, [], [1] * 7, [1] * 9)]
        for value in (-1, float('nan'), float('inf'), '12', None, True):
            values = [12.0] * 8
            values[1] = value
            bad_channels.append({'status': 'good', 'values': values})
        for channel in bad_channels:
            with self.subTest(channel=channel):
                record = cap_record()
                record['left'] = channel
                with self.assertRaisesRegex(ValueError, 'No usable capacitance data'):
                    cap_frame([record], 'left')
                self.assertEqual(cap_frame([record], 'right').iloc[0]['right_out'], 13)

    def test_pod5_averages_same_second_without_filling_gaps(self):
        frame = cap_frame([cap_record(), cap_record(offset=2), cap_record(timestamp=TIMESTAMP + 2)])
        self.assertEqual(len(frame), 2)
        self.assertTrue(frame.index.is_unique)
        self.assertEqual(frame['left_out'].tolist(), [14, 13])
        self.assertEqual(frame.attrs['cap_format'], POD5_CAP_FORMAT)
        self.assertEqual((frame.index[1] - frame.index[0]).total_seconds(), 2)

    def test_invalid_readings_do_not_dilute_valid_readings(self):
        invalid = cap_record(offset=100)
        invalid['left']['values'][0] = -1
        frame = cap_frame([cap_record(), invalid])
        self.assertEqual(frame['left_out'].tolist(), [13])

    def test_legacy_dataframe_preserves_values_and_duplicate_rows(self):
        frame = cap_frame([cap_record(LEGACY_CAP_FORMAT, offset=10), cap_record(LEGACY_CAP_FORMAT)])
        self.assertEqual(frame['left_out'].tolist(), [410, 400])
        self.assertEqual(frame.attrs['cap_format'], LEGACY_CAP_FORMAT)
        self.assertEqual(frame['left_out'].dtype.kind, 'i')

    def test_empty_and_mixed_formats_have_clear_errors(self):
        with self.assertRaisesRegex(ValueError, 'No usable capacitance data'):
            cap_frame([])
        with self.assertRaisesRegex(ValueError, 'Mixed capacitance formats'):
            cap_frame([cap_record(), cap_record(LEGACY_CAP_FORMAT)])


class CapacitanceBaselineTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.paths = {side: str(Path(self.directory.name) / f'{side}.json') for side in ('left', 'right')}
        for attribute, side in [('LEFT_CAP_BASE_LINE_FILE_PATH', 'left'), ('RIGHT_CAP_BASELINE_FILE_PATH', 'right')]:
            patcher = patch.object(cap_data, attribute, self.paths[side])
            patcher.start()
            self.addCleanup(patcher.stop)

    def baseline(self, cap_format=LEGACY_CAP_FORMAT, side='left'):
        frame = cap_frame([cap_record(cap_format, TIMESTAMP + offset) for offset in range(3)], side)
        return cap_data.create_cap_baseline_from_cap_df(
            frame, frame.index[0], frame.index[-1], side, cap_format=cap_format
        )

    def test_legacy_baseline_shape_scale_and_loading_are_preserved(self):
        for side in ('left', 'right'):
            with self.subTest(side=side):
                baseline = self.baseline(side=side)
                self.assertEqual(baseline[f'{side}_out'], {'mean': 400, 'std': 5})
                cap_data.save_baseline(side, baseline)
                self.assertEqual(json.loads(Path(self.paths[side]).read_text()), baseline)
                self.assertEqual(cap_data.load_baseline(side), baseline)

    def test_pod5_baseline_has_separate_scale_and_format_metadata(self):
        for side in ('left', 'right'):
            with self.subTest(side=side):
                baseline = self.baseline(POD5_CAP_FORMAT, side)
                self.assertEqual(baseline[f'{side}_out'], {'mean': 13, 'std': 1})
                cap_data.save_baseline(side, baseline, POD5_CAP_FORMAT)
                saved = json.loads(Path(self.paths[side]).read_text())
                self.assertEqual(saved, {'format': 'capSense2', 'version': 1, 'channels': baseline})
                self.assertEqual(cap_data.load_baseline(side, POD5_CAP_FORMAT), baseline)

    def test_baselines_cannot_be_reused_across_formats_or_versions(self):
        for saved_format, requested_format in ((LEGACY_CAP_FORMAT, POD5_CAP_FORMAT), (POD5_CAP_FORMAT, LEGACY_CAP_FORMAT)):
            with self.subTest(saved_format=saved_format):
                cap_data.save_baseline('left', self.baseline(saved_format), saved_format)
                with self.assertRaisesRegex(ValueError, 'does not match'):
                    cap_data.load_baseline('left', requested_format)
        saved = json.loads(Path(self.paths['left']).read_text())
        saved['version'] = 2
        Path(self.paths['left']).write_text(json.dumps(saved))
        with self.assertRaisesRegex(ValueError, 'does not match'):
            cap_data.load_baseline('left', POD5_CAP_FORMAT)

    def test_invalid_calibration_does_not_replace_existing_baseline(self):
        baseline = self.baseline()
        cap_data.save_baseline('left', baseline)
        original = Path(self.paths['left']).read_bytes()
        baseline['left_out']['std'] = float('nan')
        with self.assertRaisesRegex(ValueError, 'Invalid left capacitance baseline'):
            cap_data.save_baseline('left', baseline)
        self.assertEqual(Path(self.paths['left']).read_bytes(), original)
        frame = cap_frame([cap_record()])
        for start, end in ((None, None), (frame.index[0], frame.index[0])):
            with self.subTest(start=start), self.assertRaises(ValueError):
                cap_data.create_cap_baseline_from_cap_df(frame, start, end, 'left', cap_format=POD5_CAP_FORMAT)

    def test_presence_math_matches_legacy_and_detects_pod5_changes(self):
        for cap_format in (LEGACY_CAP_FORMAT, POD5_CAP_FORMAT):
            with self.subTest(cap_format=cap_format):
                frame = cap_frame([cap_record(cap_format, TIMESTAMP + offset, 0 if offset < 5 else 10) for offset in range(10)])
                cap_data.detect_presence_cap(frame, self.baseline(cap_format), 'left', occupancy_threshold=5,
                                             rolling_seconds=1, threshold_percent=1, clean=False)
                self.assertEqual(frame['cap_left_occupied'].tolist(), [0] * 5 + [1] * 5)
                expected_delta = 30 / cap_format.min_std
                np.testing.assert_allclose(frame['left_combined'], [0] * 5 + [expected_delta] * 5)

    def test_baseline_period_requires_five_minutes_with_sufficient_coverage(self):
        frame = cap_frame([cap_record(timestamp=TIMESTAMP + offset) for offset in range(300)])
        frame['left1_range'] = 0
        self.assertEqual(identify_baseline_period(frame, 'left'), (frame.index[0], frame.index[0] + timedelta(minutes=5)))
        self.assertEqual(identify_baseline_period(frame.iloc[:299], 'left'), (None, None))
        self.assertEqual(identify_baseline_period(frame.iloc[::2], 'left'), (None, None))

    def test_calibration_and_detection_use_matching_formats_end_to_end(self):
        start = datetime.fromtimestamp(TIMESTAMP, timezone.utc)
        for cap_format, sensor_count in ((LEGACY_CAP_FORMAT, 2), (LEGACY_CAP_FORMAT, 1), (POD5_CAP_FORMAT, 1)):
            with self.subTest(cap_format=cap_format, sensor_count=sensor_count), tempfile.TemporaryDirectory() as directory:
                records = []
                for offset in range(360):
                    # Small changing readings avoid duplicate rows while keeping the empty bed stable.
                    records.append(wrap_record(cap_record(cap_format, TIMESTAMP + offset, offset * 0.001)))
                    if cap_format == POD5_CAP_FORMAT:
                        records.append(wrap_record(cap_record(cap_format, TIMESTAMP + offset, offset * 0.001)))
                    piezo = {'type': 'piezo-dual', 'ts': TIMESTAMP + offset, 'freq': 500, 'adc': 65, 'gain': 400}
                    for side in ('left', 'right'):
                        for sensor in range(1, sensor_count + 1):
                            piezo[f'{side}{sensor}'] = struct.pack('<iii', 10, 20, 30)
                    records.append(wrap_record(piezo))
                Path(directory, 'sample.RAW').write_bytes(b''.join(records))
                with patch.object(load_raw_files, 'is_nats_running', return_value=False):
                    for side in ('left', 'right'):
                        calibration.calibrate_sensor_thresholds(side, start, start + timedelta(minutes=6), directory)
                        baseline = cap_data.load_baseline(side, cap_format)
                        self.assertEqual(baseline[f'{side}_out']['std'], cap_format.min_std)
                        frame = sleep_detector.detect_sleep(side, start, start + timedelta(minutes=6), directory)
                        self.assertEqual(len(frame), 360)
                        self.assertTrue(frame.index.is_unique)
                        self.assertEqual(frame[f'cap_{side}_occupied'].sum(), 0)


class CapacitanceNatsTests(unittest.TestCase):
    def test_nats_normalizes_formats_and_continues_after_bad_messages(self):
        start = datetime.fromtimestamp(TIMESTAMP, timezone.utc)
        for cap_format in (LEGACY_CAP_FORMAT, POD5_CAP_FORMAT):
            for side in ('left', 'right'):
                with self.subTest(cap_format=cap_format, side=side):
                    payloads = [
                        cbor2.dumps(cap_record(cap_format, TIMESTAMP - 1)),
                        cbor2.dumps(cap_record(cap_format)),
                        b'\xa1',
                        cbor2.dumps([]),
                        cbor2.dumps({'type': 'capSense2', 'version': 99}),
                        cbor2.dumps(cap_record(cap_format, TIMESTAMP + 1)),
                        cbor2.dumps(cap_record(cap_format, TIMESTAMP + 2)),
                    ]
                    messages = [Mock(data=payload, ack=AsyncMock()) for payload in payloads]
                    subscription = Mock(next_msg=AsyncMock(side_effect=messages))
                    jetstream = Mock(subscribe=AsyncMock(return_value=subscription))
                    connection = Mock(is_connected=True, jetstream=Mock(return_value=jetstream), close=AsyncMock())
                    with patch.object(nats, 'connect', AsyncMock(return_value=connection)):
                        data = asyncio.run(load_raw_files._fetch_jetstream_historical_data(
                            start, start + timedelta(seconds=2), ['capSense'], side, 1
                        ))
                    self.assertEqual(len(data['capSense']), 2)
                    frame = cap_data.load_cap_df({'cap_senses': data['capSense']}, side)
                    self.assertEqual(frame.attrs['cap_format'], cap_format)
                    self.assertTrue(all(('right' if side == 'left' else 'left') not in record for record in data['capSense']))
                    for message in messages:
                        message.ack.assert_awaited_once()
                    connection.close.assert_awaited_once()


if __name__ == '__main__':
    unittest.main()
