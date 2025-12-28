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
- Detects shivering for thermal comfort monitoring (temperature control integration).

Usage:
Instantiate `StreamProcessor` with an initial piezo record and call `process_piezo_record(piezo_record)`
with new sensor data to continuously track and analyze biometric trends.
"""
import sys
import json
import os
import urllib.request
import urllib.error
from get_logger import get_logger
from biometric_processor import BiometricProcessor
from buffer import Buffer
from data_types import *
import numpy as np

# Import detection functions from heart module
sys.path.insert(0, '/home/dac/free-sleep/biometrics')
from heart.bcg_peakdetection import bcg_detect_shivering, bcg_detect_motion

# Temperature adjustment settings
SERVER_API_URL = 'http://localhost:5000/api/device-status'
ADJUSTMENT_COOLDOWN_S = 600  # 10 min between any adjustments (thermal lag)

# Shivering detection (too cold → warm up)
SHIVER_WARMTH_ADJUSTMENT = 10  # Level units to increase (~1.5°C)
SHIVER_THRESHOLD = 0.3  # Only trigger on high-confidence shivering

# Restlessness detection (too warm → cool down)
RESTLESS_COOL_ADJUSTMENT = -10  # Level units to decrease (~1.5°C)
RESTLESS_THRESHOLD = 0.4  # Fraction of time with motion to trigger
RESTLESS_WINDOW_S = 300  # 5 min window to measure restlessness

# Sleep onset detection (falling asleep → cool down to help)
SLEEP_ONSET_COOL_ADJUSTMENT = -5  # Level units to decrease (~0.75°C)
HR_DROP_THRESHOLD = 5  # BPM drop from baseline to indicate sleep onset
MOTION_SETTLE_THRESHOLD = 0.1  # Low motion fraction to confirm settling

# Safety limits - max deviation from initial scheduled temperature
MAX_HEURISTIC_ADJUSTMENT = 25  # ±25 levels (~3.75°C / ~6.75°F) max total adjustment

# Thermal events log file (for chart visualization)
THERMAL_EVENTS_FILE = '/tmp/thermal_events.json'
MAX_THERMAL_EVENTS = 100  # Keep last N events

logger = get_logger()

# Thermal comfort monitoring constants
THERMAL_ANALYSIS_INTERVAL_SECONDS = 30  # How often to check for shivering
THERMAL_WINDOW_SECONDS = 60  # How much data to analyze
PIEZO_SAMPLE_RATE = 500  # Hz


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

        # Thermal heuristics state
        self.thermal_state = {
            'left': {
                'shiver_history': [],
                'motion_history': [],  # For restlessness detection
                'hr_history': [],  # For sleep onset detection
                'last_adjustment_time': 0,
                'sleep_onset_triggered': False,  # Only trigger once per session
                'awake_hr_baseline': None,  # HR when awake (first few minutes)
                'base_level': None,  # Initial scheduled level (set on first adjustment)
                'cumulative_adjustment': 0,  # Total adjustment from base level
            },
            'right': {
                'shiver_history': [],
                'motion_history': [],
                'hr_history': [],
                'last_adjustment_time': 0,
                'sleep_onset_triggered': False,
                'awake_hr_baseline': None,
                'base_level': None,
                'cumulative_adjustment': 0,
            },
        }

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

    def can_calculate_thermal(self):
        return (
            self.iteration_count > THERMAL_WINDOW_SECONDS
            and self.iteration_count % THERMAL_ANALYSIS_INTERVAL_SECONDS == 0
        )

    def run_thermal_heuristics(self, side: str, piezo_signal: np.ndarray, epoch: int):
        """
        Run all thermal heuristics and adjust temperature if needed.
        Heuristics: shivering (warm up), restlessness (cool down), sleep onset (cool down).
        """
        state = self.thermal_state[side]
        last_adj = state['last_adjustment_time']
        time_since_adj = epoch - last_adj
        cooldown_active = time_since_adj < ADJUSTMENT_COOLDOWN_S

        if cooldown_active:
            remaining = ADJUSTMENT_COOLDOWN_S - time_since_adj
            logger.debug(f'[{side}] Thermal heuristics cooldown active ({remaining:.0f}s remaining)')
            return

        try:
            # Get processor for this side to access HR
            processor = self.left_processor if side == 'left' else self.right_processor

            # === 1. SHIVERING DETECTION (too cold → warm up) ===
            shiver_mask, shiver_power = bcg_detect_shivering(
                piezo_signal, PIEZO_SAMPLE_RATE, window_seconds=5.0
            )
            shiver_fraction = float(np.mean(shiver_mask)) if len(shiver_mask) > 0 else 0.0
            shiver_intensity = float(np.mean(shiver_power)) / 2.0 if len(shiver_power) > 0 else 0.0
            shiver_score = max(0.0, min(1.0, shiver_fraction * 0.5 + (shiver_intensity - 1.0) * 0.5))

            state['shiver_history'].append(shiver_score)
            if len(state['shiver_history']) > 5:
                state['shiver_history'].pop(0)
            shiver_smoothed = float(np.mean(state['shiver_history']))

            if shiver_smoothed > SHIVER_THRESHOLD:
                logger.info(f'🥶 [{side}] Shivering detected! score={shiver_score:.2f} smoothed={shiver_smoothed:.2f} - warming up!')
                self._adjust_temperature(side, SHIVER_WARMTH_ADJUSTMENT, 'shivering', epoch)
                state['last_adjustment_time'] = epoch
                return  # Only one adjustment per cycle

            # === 2. RESTLESSNESS DETECTION (too warm → cool down) ===
            # Use LPS motion detection - need to get LPS signal from buffer
            # For now, detect motion from piezo variance as a proxy
            motion_mask, _ = bcg_detect_motion(piezo_signal, PIEZO_SAMPLE_RATE)
            motion_fraction = float(np.mean(motion_mask)) if len(motion_mask) > 0 else 0.0

            state['motion_history'].append(motion_fraction)
            # Keep enough history for RESTLESS_WINDOW_S (at 30s intervals)
            max_motion_history = max(1, RESTLESS_WINDOW_S // THERMAL_ANALYSIS_INTERVAL_SECONDS)
            if len(state['motion_history']) > max_motion_history:
                state['motion_history'].pop(0)
            motion_avg = float(np.mean(state['motion_history']))

            # Only trigger if restless AND not shivering (shivering looks like motion)
            if motion_avg > RESTLESS_THRESHOLD and shiver_smoothed < 0.1:
                logger.info(f'🥵 [{side}] Restlessness detected! motion={motion_avg:.2f} - cooling down!')
                self._adjust_temperature(side, RESTLESS_COOL_ADJUSTMENT, 'restlessness', epoch)
                state['last_adjustment_time'] = epoch
                return

            # === 3. SLEEP ONSET DETECTION (falling asleep → cool down to help) ===
            if not state['sleep_onset_triggered'] and processor.hr_moving_avg is not None:
                current_hr = processor.hr_moving_avg

                # Track HR history
                state['hr_history'].append(current_hr)
                if len(state['hr_history']) > 10:
                    state['hr_history'].pop(0)

                # Establish baseline from first few readings (when likely awake)
                if state['awake_hr_baseline'] is None and len(state['hr_history']) >= 3:
                    state['awake_hr_baseline'] = float(np.mean(state['hr_history'][:3]))
                    logger.debug(f'[{side}] Established awake HR baseline: {state["awake_hr_baseline"]:.1f} bpm')

                # Check for sleep onset: HR dropped + motion settled
                if state['awake_hr_baseline'] is not None and len(state['hr_history']) >= 5:
                    recent_hr = float(np.mean(state['hr_history'][-3:]))
                    hr_drop = state['awake_hr_baseline'] - recent_hr

                    if hr_drop >= HR_DROP_THRESHOLD and motion_avg < MOTION_SETTLE_THRESHOLD:
                        logger.info(f'😴 [{side}] Sleep onset detected! HR dropped {hr_drop:.1f} bpm, motion settled - cooling to help sleep!')
                        self._adjust_temperature(side, SLEEP_ONSET_COOL_ADJUSTMENT, 'sleep_onset', epoch)
                        state['last_adjustment_time'] = epoch
                        state['sleep_onset_triggered'] = True  # Only once per session
                        return

        except Exception as e:
            logger.error(f'Thermal heuristics error for {side}: {e}')

    def _is_auto_temp_enabled(self, side: str) -> bool:
        """Check if auto temperature adjustment is enabled for this side."""
        try:
            req = urllib.request.Request('http://localhost:5000/api/settings')
            with urllib.request.urlopen(req, timeout=5) as resp:
                settings = json.loads(resp.read().decode())
            return settings.get(side, {}).get('autoTempAdjust', {}).get('enabled', True)
        except Exception as e:
            logger.warning(f'Could not check auto temp setting: {e}')
            return True  # Default to enabled if can't read settings

    def _log_thermal_event(self, event_type: str, side: str, level_delta: int,
                           old_level: float, new_level: float, epoch: int):
        """Log thermal event to JSON file for chart visualization."""
        try:
            # Load existing events
            events = []
            if os.path.exists(THERMAL_EVENTS_FILE):
                try:
                    with open(THERMAL_EVENTS_FILE, 'r') as f:
                        events = json.load(f)
                except (json.JSONDecodeError, IOError):
                    events = []

            # Add new event
            event = {
                'timestamp': epoch,
                'type': event_type,  # 'shivering', 'restlessness', 'sleep_onset'
                'side': side,
                'delta': level_delta,
                'old_level': round(old_level),
                'new_level': round(new_level),
            }
            events.append(event)

            # Keep only last N events
            if len(events) > MAX_THERMAL_EVENTS:
                events = events[-MAX_THERMAL_EVENTS:]

            # Write back
            with open(THERMAL_EVENTS_FILE, 'w') as f:
                json.dump(events, f)

        except Exception as e:
            logger.error(f'Failed to log thermal event: {e}')

    def _adjust_temperature(self, side: str, level_delta: int, event_type: str, epoch: int):
        """
        Call server API to adjust temperature level.
        Clamps total adjustment to ±MAX_HEURISTIC_ADJUSTMENT from initial level.
        Logs event for chart visualization.
        """
        state = self.thermal_state[side]

        try:
            # Check if auto temperature adjustment is enabled
            if not self._is_auto_temp_enabled(side):
                logger.debug(f'Auto temp adjustment disabled for {side}, skipping')
                return

            # First get current status to know current level
            req = urllib.request.Request(SERVER_API_URL)
            with urllib.request.urlopen(req, timeout=5) as resp:
                current = json.loads(resp.read().decode())

            # Get current level for this side
            side_status = current.get(side, {})
            current_temp_f = side_status.get('targetTemperatureF', 82.5)
            # Convert F to level: level = (tempF - 82.5) / 27.5 * 100
            current_level = (current_temp_f - 82.5) / 27.5 * 100

            # Capture base level on first adjustment (the user's intended temp)
            if state['base_level'] is None:
                state['base_level'] = current_level
                state['cumulative_adjustment'] = 0
                logger.debug(f'[{side}] Captured base level: {current_level:.0f}')
            else:
                # Detect if scheduler changed the temperature externally
                expected_level = state['base_level'] + state['cumulative_adjustment']
                drift = abs(current_level - expected_level)
                if drift > 5:  # More than 5 levels drift = external change
                    logger.info(f'[{side}] Detected external temp change (expected {expected_level:.0f}, got {current_level:.0f}) - resetting base')
                    state['base_level'] = current_level
                    state['cumulative_adjustment'] = 0

            # Check if proposed adjustment would exceed limit
            proposed_cumulative = state['cumulative_adjustment'] + level_delta
            clamped_cumulative = max(-MAX_HEURISTIC_ADJUSTMENT,
                                     min(MAX_HEURISTIC_ADJUSTMENT, proposed_cumulative))

            if clamped_cumulative == state['cumulative_adjustment']:
                # Already at limit, can't adjust further in this direction
                logger.info(f'[{side}] At max heuristic adjustment limit ({state["cumulative_adjustment"]:+.0f}), skipping')
                return

            # Calculate actual delta after clamping
            actual_delta = clamped_cumulative - state['cumulative_adjustment']
            state['cumulative_adjustment'] = clamped_cumulative

            # Calculate new level
            new_level = max(-100, min(100, current_level + actual_delta))
            new_temp_f = (new_level / 100) * 27.5 + 82.5

            # Send update
            payload = json.dumps({
                side: {
                    'targetTemperatureF': new_temp_f
                }
            }).encode()

            req = urllib.request.Request(
                SERVER_API_URL,
                data=payload,
                headers={'Content-Type': 'application/json'},
                method='PUT'
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                result = resp.read().decode()

            logger.info(f'🔥 [{side}] Temperature adjusted: level {current_level:.0f} -> {new_level:.0f} (cumulative: {clamped_cumulative:+.0f} from base {state["base_level"]:.0f})')

            # Log event for chart visualization
            self._log_thermal_event(event_type, side, actual_delta, current_level, new_level, epoch)

        except urllib.error.URLError as e:
            logger.error(f'Failed to adjust temperature for {side}: {e}')
        except Exception as e:
            logger.error(f'Temperature adjustment error for {side}: {e}')

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

                # Thermal heuristics (shivering, restlessness, sleep onset)
                if self.can_calculate_thermal():
                    thermal_signal = self.buffer.get_signal('left', THERMAL_WINDOW_SECONDS)
                    self.run_thermal_heuristics('left', thermal_signal, epoch)

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

                # Thermal heuristics (shivering, restlessness, sleep onset)
                if self.can_calculate_thermal():
                    thermal_signal = self.buffer.get_signal('right', THERMAL_WINDOW_SECONDS)
                    self.run_thermal_heuristics('right', thermal_signal, epoch)



