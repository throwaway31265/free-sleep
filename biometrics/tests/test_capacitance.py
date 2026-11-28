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
    from piezo_data import baseline_range_threshold, identify_baseline_period, load_piezo_df
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

    def test_calibration_finds_a_baseline_in_pod5_empty_bed_noise(self):
        # Per-second piezo means alternate by 20k: above the old 10k ceiling, below the Pod 5 one.
        start = datetime.fromtimestamp(TIMESTAMP, timezone.utc)
        with tempfile.TemporaryDirectory() as directory:
            records = []
            for offset in range(360):
                records.append(wrap_record(cap_record(LEGACY_CAP_FORMAT, TIMESTAMP + offset, offset * 0.001)))
                level = 20_000 if offset % 2 else 0
                samples = struct.pack('<iii', level, level + 1, level + 2)
                piezo = {'type': 'piezo-dual', 'ts': TIMESTAMP + offset, 'freq': 500, 'adc': 66, 'gain': 400,
                         'version': 2, 'left': {'gain': 400}, 'right': {'gain': 400}}
                for side in ('left', 'right'):
                    piezo[f'{side}1'] = samples
                records.append(wrap_record(piezo))
            Path(directory, 'sample.RAW').write_bytes(b''.join(records))
            with patch.object(load_raw_files, 'is_nats_running', return_value=False), \
                    patch.object(calibration, 'identify_baseline_period', wraps=calibration.identify_baseline_period) as spy:
                calibration.calibrate_sensor_thresholds('right', start, start + timedelta(minutes=6), directory)
            self.assertEqual(spy.call_args.kwargs['threshold_range'], 50_000)
            baseline = cap_data.load_baseline('right', LEGACY_CAP_FORMAT)
            self.assertIn('right_out', baseline)

    def test_pod5_empty_bed_noise_finds_a_baseline(self):
        index = pd.date_range('2026-11-27 18:30:00', periods=600, freq='s')
        merged_df = pd.DataFrame({
            'right1_range': np.where(np.arange(600) % 60 == 0, 15_000, 5_000),  # quiet bed with small spikes
            'right_out': 978.0, 'right_cen': 1160.0, 'right_in': 1372.0,
        }, index=index)
        self.assertEqual(identify_baseline_period(merged_df, 'right', threshold_range=10_000), (None, None))
        start, _ = identify_baseline_period(merged_df, 'right', threshold_range=baseline_range_threshold(2))
        self.assertEqual(start, index[0])


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



def pod5_piezo_record(timestamp=TIMESTAMP, offset=0):
    """Pod 5 piezo-dual (version 2) shape: per-side gain maps beside the int32 sample buffers."""
    samples = struct.pack('<4i', 100 + offset, 200 + offset, 300 + offset, 400 + offset)
    return {
        'type': 'piezo-dual', 'ts': timestamp, 'freq': 500, 'adc': 66, 'gain': 400, 'version': 2,
        'left': {'gain': 400}, 'right': {'gain': 400},
        'left1': samples, 'left2': samples, 'right1': samples, 'right2': samples,
    }


class Pod5PiezoTests(unittest.TestCase):
    def test_delete_other_side_drops_per_side_metadata_maps(self):
        record = pod5_piezo_record()
        load_raw_files._delete_other_side(record, 'right', sensor_count=1)
        self.assertNotIn('left', record)
        self.assertNotIn('right', record)
        self.assertNotIn('left1', record)
        self.assertNotIn('right2', record)
        self.assertIn('right1', record)

    def test_merged_piezo_and_cap_frames_can_drop_duplicates(self):
        piezo_records, cap_records = [], []
        for second in range(60):
            record = pod5_piezo_record(TIMESTAMP + second, offset=second * 1000)
            load_raw_files._delete_other_side(record, 'right', sensor_count=1)
            load_raw_files.load_piezo_row(record, 'right')
            record['ts'] = datetime.fromtimestamp(record['ts'], timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
            piezo_records.append(record)

            cap = normalize_capacitance_record(cap_record(timestamp=TIMESTAMP + second, offset=second))
            load_raw_files._delete_other_side(cap, 'right', sensor_count=1)
            cap['ts'] = datetime.fromtimestamp(cap['ts'], timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
            cap_records.append(cap)

        piezo_df = load_piezo_df({'piezo_dual': piezo_records}, 'right')
        cap_df = cap_data.load_cap_df({'cap_senses': cap_records}, 'right')
        merged_df = piezo_df.merge(cap_df, on='ts', how='inner')
        # Raised "TypeError: unhashable type: 'dict'" before the metadata maps were stripped.
        merged_df.drop_duplicates(inplace=True)
        self.assertGreater(len(merged_df), 0)
        self.assertNotIn('left', merged_df.columns)
        self.assertNotIn('right', merged_df.columns)


def loaded_piezo_df(make_record, seconds=30):
    records = []
    for second in range(seconds):
        record = make_record(TIMESTAMP + second, offset=second * 1000)
        load_raw_files._delete_other_side(record, 'right', sensor_count=1)
        load_raw_files.load_piezo_row(record, 'right')
        record['ts'] = datetime.fromtimestamp(record['ts'], timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
        records.append(record)
    return load_piezo_df({'piezo_dual': records}, 'right')


def pod3_piezo_record(timestamp=TIMESTAMP, offset=0):
    record = pod5_piezo_record(timestamp, offset)
    for key in ('version', 'left', 'right'):
        del record[key]
    return record


class BaselineThresholdTests(unittest.TestCase):
    def test_pod5_records_use_the_pod5_baseline_threshold(self):
        piezo_df = loaded_piezo_df(pod5_piezo_record)
        self.assertEqual(piezo_df.attrs['piezo_version'], 2)
        self.assertEqual(baseline_range_threshold(piezo_df.attrs['piezo_version']), 50_000)

    def test_records_without_a_version_keep_the_pod3_threshold(self):
        piezo_df = loaded_piezo_df(pod3_piezo_record)
        self.assertEqual(piezo_df.attrs['piezo_version'], 1)
        self.assertEqual(baseline_range_threshold(piezo_df.attrs['piezo_version']), 10_000)

    def test_version_1_records_keep_the_pod3_threshold(self):
        def version_1_record(timestamp=TIMESTAMP, offset=0):
            record = pod3_piezo_record(timestamp, offset)
            record['version'] = 1
            return record

        piezo_df = loaded_piezo_df(version_1_record)
        self.assertEqual(piezo_df.attrs['piezo_version'], 1)
        self.assertEqual(baseline_range_threshold(piezo_df.attrs['piezo_version']), 10_000)


if __name__ == '__main__':
    unittest.main()
