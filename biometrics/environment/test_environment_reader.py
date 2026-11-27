"""Decode and range-filter coverage for the NATS environment reader (runs without NATS)."""

from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))

import environment_reader as reader  # noqa: E402

NOW = 1795744110.0

# Captured from raw.sens.bedtemp on a Pod 5 (centi-degC / centi-%RH).
BEDTEMP_SAMPLE = {
    'type': 'bedTemp2',
    'ts': 1795744105,
    'amb': 2138,
    'hu': 5369,
    'mcu': 2841,
    'left': {'side': 2155, 'out': 2133, 'cen': 2145, 'in': 2164},
    'right': {'side': 2201, 'out': 2188, 'cen': 2195, 'in': 2210},
    'seq': 1610686,
}

THERM_SAMPLE = {
    'ts': 1795744108,
    'left': {'target': 15.48, 'power': -1.0},
    'right': {'target': 18.0, 'power': -0.86},
}


class DecodeTests(unittest.TestCase):
    def test_bedtemp_sample_is_scaled_to_celsius(self):
        decoded = reader.decode_bedtemp(BEDTEMP_SAMPLE)
        self.assertEqual(decoded['ambientC'], 21.38)
        self.assertEqual(decoded['humidity'], 53.69)
        self.assertEqual(decoded['mcuC'], 28.41)
        self.assertEqual(decoded['bed']['left'], {'sideC': 21.55, 'outC': 21.33, 'cenC': 21.45, 'inC': 21.64})
        self.assertEqual(decoded['bed']['right']['inC'], 22.1)

    def test_therm_sample_keeps_float_target_and_power(self):
        decoded = reader.decode_therm(THERM_SAMPLE)
        self.assertEqual(decoded['left'], {'targetC': 15.48, 'power': -1.0})
        self.assertEqual(decoded['right'], {'targetC': 18.0, 'power': -0.86})

    def test_out_of_range_values_are_dropped(self):
        message = dict(BEDTEMP_SAMPLE, amb=4500, hu=10100, left={'side': 400, 'out': 5100, 'cen': 500, 'in': 5000})
        decoded = reader.decode_bedtemp(message)
        self.assertIsNone(decoded['ambientC'])
        self.assertIsNone(decoded['humidity'])
        self.assertEqual(decoded['bed']['left'], {'sideC': None, 'outC': None, 'cenC': 5.0, 'inC': 50.0})

        therm = reader.decode_therm({'left': {'target': 15.0, 'power': -1.2}, 'right': {'target': 18.0, 'power': 1.0}})
        self.assertIsNone(therm['left']['power'])
        self.assertEqual(therm['right']['power'], 1.0)

    def test_non_numeric_and_missing_values_are_dropped(self):
        decoded = reader.decode_bedtemp({'amb': True, 'hu': '5369', 'left': 'broken'})
        self.assertIsNone(decoded['ambientC'])
        self.assertIsNone(decoded['humidity'])
        self.assertIsNone(decoded['mcuC'])
        self.assertEqual(decoded['bed']['left'], {'sideC': None, 'outC': None, 'cenC': None, 'inC': None})


class BuildSampleTests(unittest.TestCase):
    def test_fresh_messages_merge_into_payload(self):
        sample = reader.build_sample((BEDTEMP_SAMPLE, NOW - 5), (THERM_SAMPLE, NOW - 2), NOW)
        self.assertEqual(sample['ts'], int(NOW))
        self.assertEqual(sample['ambientC'], 21.38)
        self.assertEqual(sample['bed']['left']['cenC'], 21.45)
        self.assertEqual(sample['therm']['right']['power'], -0.86)
        self.assertTrue(reader.has_any_value(sample))

    def test_stale_message_ts_drops_its_fields(self):
        stale_bedtemp = dict(BEDTEMP_SAMPLE, ts=NOW - 61)
        sample = reader.build_sample((stale_bedtemp, NOW), (THERM_SAMPLE, NOW), NOW)
        self.assertIsNone(sample['ambientC'])
        self.assertIsNone(sample['bed']['left']['cenC'])
        self.assertEqual(sample['therm']['left']['targetC'], 15.48)

    def test_missing_ts_falls_back_to_arrival_time(self):
        message = {key: value for key, value in BEDTEMP_SAMPLE.items() if key != 'ts'}
        self.assertEqual(reader.build_sample((message, NOW - 30), None, NOW)['ambientC'], 21.38)
        self.assertIsNone(reader.build_sample((message, NOW - 90), None, NOW)['ambientC'])

    def test_no_messages_yields_empty_sample(self):
        sample = reader.build_sample(None, None, NOW)
        self.assertEqual(set(sample), {'ts', 'ambientC', 'humidity', 'mcuC', 'bed', 'therm'})
        self.assertFalse(reader.has_any_value(sample))


class WaitForNatsTests(unittest.TestCase):
    """Fake clock: each sleep advances time, so no real waiting happens."""

    def run_wait(self, answers, wait_s=30, interval_s=10):
        clock = {'now': 0.0}
        probes = iter(answers)

        def fake_sleep(seconds):
            clock['now'] += seconds

        result = reader.wait_for_nats(wait_s, interval_s, probe=lambda: next(probes),
                                      sleep=fake_sleep, clock=lambda: clock['now'])
        return result, clock['now']

    def test_nats_that_binds_late_is_found(self):
        self.assertEqual(self.run_wait([False, False, True]), (True, 20.0))

    def test_gives_up_after_the_wait(self):
        self.assertEqual(self.run_wait([False] * 10), (False, 30.0))


class CborRoundTripTests(unittest.TestCase):
    def test_cbor_encoded_sample_decodes(self):
        try:
            import cbor2
        except ImportError:
            self.skipTest('cbor2 is not installed')
        decoded = reader.decode_bedtemp(cbor2.loads(cbor2.dumps(BEDTEMP_SAMPLE)))
        self.assertEqual(decoded['ambientC'], 21.38)


if __name__ == '__main__':
    unittest.main()
