"""
This module defines the `StreamProcessor` class, which processes continuous piezoelectric
sensor data to track user presence and extract biometric metrics such as heart rate,
heart rate variability (HRV), and breathing rate.

Key functionalities:
- Buffers incoming piezoelectric sensor data to process trends over time.
- Detects user presence based on signal strength for both left and right sides.
- Uses `BiometricProcessor` to analyze heart rate, HRV, and breathing rate.
- Supports single and dual-sensor configurations.
- Maintains a rolling buffer of sensor readings to smooth out noise.
- Extracts timestamped biometric data and logs presence detections.

Usage:
Instantiate `StreamProcessor` with an initial piezo record and call `process_piezo_record(piezo_record)`
with new sensor data to continuously track and analyze biometric trends.
"""
import sys
from get_logger import get_logger
from biometric_processor import BiometricProcessor
from buffer import Buffer
from data_types import *
import numpy as np

logger = get_logger()


class StreamProcessor:
    def __init__(
            self,
            piezo_record,
            debug=False,
    ):
        if 'left2' in piezo_record:
            self.sensor_count = 2
        else:
            self.sensor_count = 1
        self.left_processor = BiometricProcessor(side='left', sensor_count=self.sensor_count, insertion_frequency=60, debug=debug)
        self.right_processor = BiometricProcessor(side='right', sensor_count=self.sensor_count, insertion_frequency=60, debug=debug)
        self.buffer = Buffer(
            self.right_processor.heart_rate_window_seconds,
            self.right_processor.breath_rate_window_seconds,
            self.right_processor.hrv_window_seconds,
        )
        self.iteration_count = 0

    def check_presence(self, left1_signal: np.ndarray, right1_signal: np.ndarray):
        self.left_processor.detect_presence(left1_signal)
        self.right_processor.detect_presence(right1_signal)

    def can_calculate_breath_rate(self):
        return (
            self.iteration_count > self.left_processor.breath_rate_window_seconds
            and self.iteration_count % self.left_processor.breath_rate_insertion_frequency == 0
        )

    def can_calculate_hrv(self):
        return (
            self.iteration_count > self.left_processor.hrv_window_seconds
            and self.iteration_count % self.left_processor.hrv_insertion_frequency == 0
        )

    def process_piezo_record(self, piezo_record: PiezoDualData):
        self.iteration_count += 1
        self.buffer.append(piezo_record)
        if self.iteration_count > self.left_processor.heart_rate_window_seconds:
            left1_signal = self.buffer.get_heart_rate_signal('left', 1)
            right1_signal = self.buffer.get_heart_rate_signal('right', 1)

            log = self.iteration_count % 300 == 0
            epoch = piezo_record['ts']
            time = datetime.fromtimestamp(epoch)
            if log:
                logger.debug(f'Process check - Processing piezo record @ {time.isoformat()}')

            self.check_presence(left1_signal, right1_signal)

            # Process left side
            if self.left_processor.present_for > self.left_processor.heart_rate_window_seconds:
                if log:
                    logger.debug(f'Presence detected for left side @ {time.isoformat()}')

                left2_signal = None
                if self.sensor_count == 2:
                    left2_signal = self.buffer.get_heart_rate_signal('left', 2)

                # Heart rate calculation
                self.left_processor.calculate_heart_rate(epoch, left1_signal, left2_signal)

                # Breath rate calculation
                if self.can_calculate_breath_rate() and self.left_processor.present_for >= self.left_processor.breath_rate_window_seconds:
                    breath_rate_signal = self.buffer.get_signal('left', self.left_processor.breath_rate_window_seconds)
                    self.left_processor.calculate_breath_rate(breath_rate_signal, epoch)

                # HRV calculation
                if self.can_calculate_hrv() and self.left_processor.present_for >= self.left_processor.hrv_window_seconds:
                    hrv_signal = self.buffer.get_signal('left', self.left_processor.hrv_window_seconds)
                    self.left_processor.calculate_hrv(hrv_signal, epoch)

            # Process right side
            if self.right_processor.present_for > self.right_processor.heart_rate_window_seconds:
                if log:
                    logger.debug(f'Presence detected for right side @ {time.isoformat()}')

                right2_signal = None
                if self.sensor_count == 2:
                    right2_signal = self.buffer.get_heart_rate_signal('right', 2)

                # Heart rate calculation
                self.right_processor.calculate_heart_rate(epoch, right1_signal, right2_signal)

                # Breath rate calculation
                if self.can_calculate_breath_rate() and self.right_processor.present_for >= self.right_processor.breath_rate_window_seconds:
                    breath_rate_signal = self.buffer.get_signal('right', self.right_processor.breath_rate_window_seconds)
                    self.right_processor.calculate_breath_rate(breath_rate_signal, epoch)

                # HRV calculation
                if self.can_calculate_hrv() and self.right_processor.present_for >= self.right_processor.hrv_window_seconds:
                    hrv_signal = self.buffer.get_signal('right', self.right_processor.hrv_window_seconds)
                    self.right_processor.calculate_hrv(hrv_signal, epoch)



