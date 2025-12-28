"""
Real-time thermal comfort monitoring for temperature control integration.

This module adds shivering detection to the stream processor and outputs
thermal state to a JSON file that the temperature controller can read.

Integration:
1. StreamProcessor calls update_thermal_state() with buffered piezo data
2. Thermal state is written to /tmp/thermal_comfort_{side}.json
3. Temperature controller reads this file and adjusts setpoint if needed
"""

import json
import os
import time
import numpy as np
from typing import Optional
from collections import deque

import sys
sys.path.insert(0, '/home/dac/free-sleep/biometrics')

from heart.thermal_comfort import (
    analyze_thermal_comfort,
    ThermalState,
    ThermalConfidence,
)
from heart.bcg_peakdetection import bcg_detect_shivering


class ThermalMonitor:
    """
    Real-time thermal comfort monitor for a single side.

    Accumulates piezo data and periodically analyzes for shivering.
    Writes thermal state to JSON for temperature controller consumption.
    """

    def __init__(
        self,
        side: str,
        sample_rate: int = 500,
        analysis_interval_seconds: float = 30.0,
        buffer_seconds: float = 60.0,
        output_dir: str = '/tmp',
    ):
        self.side = side
        self.sample_rate = sample_rate
        self.analysis_interval_seconds = analysis_interval_seconds
        self.buffer_seconds = buffer_seconds
        self.output_path = os.path.join(output_dir, f'thermal_comfort_{side}.json')

        # Circular buffer for piezo samples
        buffer_size = int(buffer_seconds * sample_rate)
        self.piezo_buffer = deque(maxlen=buffer_size)

        # Timing
        self.last_analysis_time = 0.0
        self.samples_since_analysis = 0

        # State history for smoothing
        self.shiver_history = deque(maxlen=5)
        self.state_history = deque(maxlen=10)

        # Current state
        self.current_state = {
            'state': 'unknown',
            'confidence': 'low',
            'recommendation': 'none',
            'shiver_score': 0.0,
            'shiver_score_smoothed': 0.0,
            'timestamp': 0,
            'side': side,
        }

    def add_samples(self, samples: np.ndarray):
        """Add new piezo samples to the buffer."""
        self.piezo_buffer.extend(samples)
        self.samples_since_analysis += len(samples)

    def should_analyze(self) -> bool:
        """Check if enough time/samples have passed for analysis."""
        samples_threshold = int(self.analysis_interval_seconds * self.sample_rate)
        return self.samples_since_analysis >= samples_threshold

    def analyze(self) -> dict:
        """
        Analyze buffered data for thermal comfort.
        Returns the current thermal state.
        """
        if len(self.piezo_buffer) < self.sample_rate * 30:
            # Need at least 30s of data
            return self.current_state

        # Convert buffer to numpy array
        piezo_data = np.array(self.piezo_buffer, dtype=np.float32)

        # Run shivering detection
        shiver_mask, shiver_power = bcg_detect_shivering(
            piezo_data, self.sample_rate, window_seconds=5.0
        )

        # Calculate scores
        shiver_fraction = np.mean(shiver_mask) if len(shiver_mask) > 0 else 0
        shiver_intensity = np.mean(shiver_power) / 2.0 if len(shiver_power) > 0 else 0
        shiver_score = max(0.0, min(1.0, shiver_fraction * 0.5 + (shiver_intensity - 1.0) * 0.5))

        # Add to history
        self.shiver_history.append(shiver_score)
        shiver_smoothed = np.mean(self.shiver_history)

        # Determine state
        if shiver_smoothed > 0.3:
            state = ThermalState.TOO_COLD
            confidence = ThermalConfidence.HIGH
            recommendation = 'warmer'
        elif shiver_smoothed > 0.15:
            state = ThermalState.TOO_COLD
            confidence = ThermalConfidence.MEDIUM
            recommendation = 'warmer'
        elif shiver_smoothed < 0.05:
            state = ThermalState.COMFORTABLE
            confidence = ThermalConfidence.MEDIUM
            recommendation = 'maintain'
        else:
            state = ThermalState.UNKNOWN
            confidence = ThermalConfidence.LOW
            recommendation = 'none'

        # Update state
        self.current_state = {
            'state': state.value,
            'confidence': confidence.value,
            'recommendation': recommendation,
            'shiver_score': float(shiver_score),
            'shiver_score_smoothed': float(shiver_smoothed),
            'shiver_max': float(np.max(shiver_power)) if len(shiver_power) > 0 else 0,
            'timestamp': int(time.time()),
            'side': self.side,
        }

        self.state_history.append(state)
        self.samples_since_analysis = 0
        self.last_analysis_time = time.time()

        return self.current_state

    def write_state(self):
        """Write current thermal state to JSON file for temperature controller."""
        try:
            with open(self.output_path, 'w') as f:
                json.dump(self.current_state, f, indent=2)
        except Exception as e:
            print(f"Error writing thermal state: {e}")

    def get_trend(self) -> str:
        """Get trend of thermal comfort over recent history."""
        if len(self.shiver_history) < 3:
            return 'insufficient_data'

        recent = np.mean(list(self.shiver_history)[-2:])
        older = np.mean(list(self.shiver_history)[:-2])

        if recent > older + 0.1:
            return 'getting_colder'
        elif recent < older - 0.1:
            return 'warming_up'
        else:
            return 'stable'


# Global monitors for left and right sides
_monitors = {}


def get_thermal_monitor(side: str) -> ThermalMonitor:
    """Get or create thermal monitor for a side."""
    if side not in _monitors:
        _monitors[side] = ThermalMonitor(side)
    return _monitors[side]


def process_piezo_for_thermal(side: str, piezo_samples: np.ndarray):
    """
    Process piezo samples for thermal comfort monitoring.

    Call this from StreamProcessor.process_piezo_record() with the buffered signal.
    """
    monitor = get_thermal_monitor(side)
    monitor.add_samples(piezo_samples)

    if monitor.should_analyze():
        state = monitor.analyze()
        monitor.write_state()
        return state

    return None


def read_thermal_state(side: str) -> Optional[dict]:
    """
    Read thermal state from JSON file.

    Use this from the temperature controller to get current thermal comfort.
    """
    path = f'/tmp/thermal_comfort_{side}.json'
    try:
        if os.path.exists(path):
            with open(path, 'r') as f:
                state = json.load(f)

            # Check staleness (ignore if > 2 minutes old)
            age = time.time() - state.get('timestamp', 0)
            if age > 120:
                return None

            return state
    except Exception:
        pass

    return None
