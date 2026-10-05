"""Legacy installations must remain usable before nats-py has been installed."""

import asyncio
import builtins
from datetime import datetime, timedelta, timezone
import importlib.util
from io import BytesIO
from pathlib import Path
import queue
import struct
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

import cbor2
import numpy as np

biometrics_path = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(biometrics_path))


class MissingNatsTests(unittest.TestCase):
    def setUp(self):
        original_import = builtins.__import__

        def import_without_nats(name, *args, **kwargs):
            if name == 'nats' or name.startswith('nats.'):
                raise ModuleNotFoundError("No module named 'nats'", name='nats')
            return original_import(name, *args, **kwargs)

        importer = patch('builtins.__import__', side_effect=import_without_nats)
        importer.start()
        self.addCleanup(importer.stop)
        modules = patch.dict(sys.modules, {
            'get_logger': Mock(get_logger=Mock(return_value=Mock())),
            'stream_processor': Mock(),
            'service_health': Mock(),
        })
        modules.start()
        self.addCleanup(modules.stop)
        self.loader = self.import_reader('legacy_loader', 'load_raw_files.py')
        self.stream = self.import_reader('legacy_stream', 'stream/stream.py')

    def import_reader(self, name, relative_path):
        specification = importlib.util.spec_from_file_location(name, biometrics_path / relative_path)
        module = importlib.util.module_from_spec(specification)
        specification.loader.exec_module(module)
        return module

    def test_legacy_historical_and_live_readers_work_without_nats(self):
        timestamp = int(datetime.now(timezone.utc).timestamp())
        piezo = {'type': 'piezo-dual', 'ts': timestamp,
                 'left1': struct.pack('<iii', 10, 20, 30), 'right1': struct.pack('<iii', 40, 50, 60)}
        wrapper = cbor2.dumps({'seq': 1, 'data': cbor2.dumps(piezo)})
        with tempfile.TemporaryDirectory() as directory:
            Path(directory, 'sample.RAW').write_bytes(wrapper)
            start = datetime.fromtimestamp(timestamp, timezone.utc)
            with patch.object(self.loader, 'is_nats_running', return_value=False):
                data = self.loader.load_raw_files(directory, start, start + timedelta(seconds=1), 'left',
                                                  sensor_count=1, raw_data_types=['piezo-dual'])
            np.testing.assert_array_equal(data['piezo_dual'][0]['left1'], [10, 20, 30])

        handler = self.stream.LatestRawFileHandler.__new__(self.stream.LatestRawFileHandler)
        handler.latest_file_obj = BytesIO(wrapper)
        handler.last_pos = 0
        handler.follow_latest_file()
        self.assertEqual(self.stream.piezo_record_queue.qsize(), 1)
        np.testing.assert_array_equal(self.stream.piezo_record_queue.get()['right1'], [40, 50, 60])

    def test_nats_history_reports_missing_package_instead_of_empty_data(self):
        start = datetime.now(timezone.utc)
        with patch.object(self.loader, 'is_nats_running', return_value=True):
            with self.assertRaisesRegex(RuntimeError, 'pip install nats-py'):
                self.loader.load_raw_files('/unused', start, start + timedelta(seconds=1), 'left')

    def test_nats_stream_reports_failed_health_and_repair_instruction(self):
        with self.assertRaisesRegex(RuntimeError, 'pip install nats-py'):
            asyncio.run(self.stream.watch_jetstream_directly())
        self.assertEqual(self.stream.update_health.call_args.args[:2], ('stream', 'failed'))

    def test_worker_can_stop_before_receiving_first_record(self):
        self.stream.piezo_record_queue = queue.Queue()
        self.stream.piezo_record_queue.put(None)
        self.stream.process_biometrics()
        self.stream.StreamProcessor.assert_not_called()


if __name__ == '__main__':
    unittest.main()
