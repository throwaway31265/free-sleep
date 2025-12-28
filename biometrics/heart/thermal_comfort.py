'''
Thermal comfort detection from BCG/LPS sensors.

Analyzes piezo and LPS data to determine if user is too cold, too warm,
or comfortable, enabling automatic temperature adjustments.

Detection methods:
- Shivering (6-14 Hz) → Too cold (high confidence)
- Restlessness without shivering → Possibly too warm (medium confidence)
- Low motion, no shivering → Comfortable (high confidence)
'''

import numpy as np
from typing import Tuple, Dict, Optional
from enum import Enum

from heart.bcg_peakdetection import (
    bcg_detect_shivering,
    bcg_detect_motion,
    bcg_process,
)


class ThermalState(Enum):
    TOO_COLD = 'too_cold'
    TOO_WARM = 'too_warm'
    COMFORTABLE = 'comfortable'
    UNKNOWN = 'unknown'


class ThermalConfidence(Enum):
    HIGH = 'high'
    MEDIUM = 'medium'
    LOW = 'low'


def analyze_thermal_comfort(
    piezo_data: np.ndarray,
    piezo_sample_rate: int,
    lps_data: Optional[np.ndarray] = None,
    lps_sample_rate: int = 200,
    analysis_window_seconds: float = 60.0,
) -> Dict:
    '''
    Analyze sensor data to determine thermal comfort state.

    Parameters
    ----------
    piezo_data : np.ndarray
        Raw piezo sensor data (for shivering detection)
    piezo_sample_rate : int
        Piezo sample rate (typically 500 Hz)
    lps_data : np.ndarray, optional
        Raw LPS sensor data (for motion detection)
    lps_sample_rate : int
        LPS sample rate (typically 200 Hz)
    analysis_window_seconds : float
        How much recent data to analyze (default 60s)

    Returns
    -------
    result : dict
        {
            'state': ThermalState,
            'confidence': ThermalConfidence,
            'recommendation': str,  # 'warmer', 'cooler', 'maintain', 'none'
            'shiver_score': float,  # 0-1, higher = more shivering
            'restlessness_score': float,  # 0-1, higher = more restless
            'details': str,  # Human-readable explanation
        }
    '''
    result = {
        'state': ThermalState.UNKNOWN,
        'confidence': ThermalConfidence.LOW,
        'recommendation': 'none',
        'shiver_score': 0.0,
        'restlessness_score': 0.0,
        'details': '',
    }

    # Use most recent data
    piezo_samples = int(analysis_window_seconds * piezo_sample_rate)
    if len(piezo_data) < piezo_samples:
        result['details'] = 'Insufficient piezo data'
        return result

    piezo_window = piezo_data[-piezo_samples:]

    # Detect shivering
    shiver_mask, shiver_power = bcg_detect_shivering(
        piezo_window, piezo_sample_rate, window_seconds=5.0
    )

    # Calculate shiver score (fraction of time shivering + intensity)
    shiver_fraction = np.mean(shiver_mask)
    shiver_intensity = np.mean(shiver_power) / 2.0  # Normalize (baseline ~1.0)
    shiver_score = min(1.0, shiver_fraction * 0.5 + (shiver_intensity - 1.0) * 0.5)
    shiver_score = max(0.0, shiver_score)

    result['shiver_score'] = shiver_score

    # Detect restlessness from LPS if available
    restlessness_score = 0.0
    if lps_data is not None:
        lps_samples = int(analysis_window_seconds * lps_sample_rate)
        if len(lps_data) >= lps_samples:
            lps_window = lps_data[-lps_samples:]
            motion_mask, _ = bcg_detect_motion(lps_window, lps_sample_rate)
            restlessness_score = np.mean(motion_mask)

    result['restlessness_score'] = restlessness_score

    # Decision logic
    if shiver_score > 0.3:
        # Clear shivering detected
        result['state'] = ThermalState.TOO_COLD
        result['confidence'] = ThermalConfidence.HIGH
        result['recommendation'] = 'warmer'
        result['details'] = f'Shivering detected (score: {shiver_score:.2f})'

    elif shiver_score > 0.15:
        # Mild shivering
        result['state'] = ThermalState.TOO_COLD
        result['confidence'] = ThermalConfidence.MEDIUM
        result['recommendation'] = 'warmer'
        result['details'] = f'Mild shivering detected (score: {shiver_score:.2f})'

    elif restlessness_score > 0.4 and shiver_score < 0.1:
        # Very restless but not shivering → probably too warm
        result['state'] = ThermalState.TOO_WARM
        result['confidence'] = ThermalConfidence.MEDIUM
        result['recommendation'] = 'cooler'
        result['details'] = f'High restlessness without shivering (restless: {restlessness_score:.2f})'

    elif restlessness_score > 0.25 and shiver_score < 0.1:
        # Moderately restless, not shivering → might be too warm
        result['state'] = ThermalState.TOO_WARM
        result['confidence'] = ThermalConfidence.LOW
        result['recommendation'] = 'cooler'
        result['details'] = f'Moderate restlessness (restless: {restlessness_score:.2f})'

    elif restlessness_score < 0.15 and shiver_score < 0.1:
        # Low motion, no shivering → comfortable
        result['state'] = ThermalState.COMFORTABLE
        result['confidence'] = ThermalConfidence.HIGH
        result['recommendation'] = 'maintain'
        result['details'] = 'Low motion, no shivering - comfortable'

    else:
        # Ambiguous
        result['state'] = ThermalState.UNKNOWN
        result['confidence'] = ThermalConfidence.LOW
        result['recommendation'] = 'none'
        result['details'] = f'Ambiguous (shiver: {shiver_score:.2f}, restless: {restlessness_score:.2f})'

    return result


def get_temperature_adjustment(
    thermal_result: Dict,
    current_temp_level: int,
    min_temp: int = -10,
    max_temp: int = 10,
    adjustment_step: int = 1,
) -> Tuple[int, str]:
    '''
    Get recommended temperature adjustment based on thermal comfort analysis.

    Parameters
    ----------
    thermal_result : dict
        Result from analyze_thermal_comfort()
    current_temp_level : int
        Current temperature level (-10 to +10 scale)
    min_temp : int
        Minimum allowed temperature level
    max_temp : int
        Maximum allowed temperature level
    adjustment_step : int
        How much to adjust per step (default 1)

    Returns
    -------
    new_temp : int
        Recommended new temperature level
    reason : str
        Explanation of the adjustment
    '''
    recommendation = thermal_result.get('recommendation', 'none')
    confidence = thermal_result.get('confidence', ThermalConfidence.LOW)
    details = thermal_result.get('details', '')

    # Only act on medium/high confidence recommendations
    if confidence == ThermalConfidence.LOW:
        return current_temp_level, f'No change (low confidence): {details}'

    if recommendation == 'warmer':
        # Increase temperature
        step = adjustment_step * 2 if confidence == ThermalConfidence.HIGH else adjustment_step
        new_temp = min(current_temp_level + step, max_temp)
        if new_temp != current_temp_level:
            return new_temp, f'Warming +{step}: {details}'
        else:
            return current_temp_level, f'Already at max temp: {details}'

    elif recommendation == 'cooler':
        # Decrease temperature
        step = adjustment_step * 2 if confidence == ThermalConfidence.HIGH else adjustment_step
        new_temp = max(current_temp_level - step, min_temp)
        if new_temp != current_temp_level:
            return new_temp, f'Cooling -{step}: {details}'
        else:
            return current_temp_level, f'Already at min temp: {details}'

    else:
        return current_temp_level, f'Maintaining: {details}'


class ThermalComfortMonitor:
    '''
    Stateful monitor for thermal comfort with smoothing and rate limiting.

    Tracks thermal state over time to avoid rapid temperature oscillations.
    '''

    def __init__(
        self,
        cooldown_seconds: float = 300.0,  # 5 min between adjustments
        history_size: int = 5,  # Number of readings to average
    ):
        self.cooldown_seconds = cooldown_seconds
        self.history_size = history_size

        self.last_adjustment_time = 0.0
        self.shiver_history = []
        self.restless_history = []
        self.state_history = []

    def update(
        self,
        piezo_data: np.ndarray,
        piezo_sample_rate: int,
        lps_data: Optional[np.ndarray] = None,
        lps_sample_rate: int = 200,
        current_time: float = None,
    ) -> Dict:
        '''
        Update monitor with new sensor data.

        Returns thermal analysis with smoothing applied.
        '''
        import time
        if current_time is None:
            current_time = time.time()

        # Get current analysis
        result = analyze_thermal_comfort(
            piezo_data, piezo_sample_rate,
            lps_data, lps_sample_rate,
        )

        # Add to history
        self.shiver_history.append(result['shiver_score'])
        self.restless_history.append(result['restlessness_score'])
        self.state_history.append(result['state'])

        # Keep history bounded
        if len(self.shiver_history) > self.history_size:
            self.shiver_history.pop(0)
            self.restless_history.pop(0)
            self.state_history.pop(0)

        # Smoothed scores
        result['shiver_score_smoothed'] = np.mean(self.shiver_history)
        result['restlessness_score_smoothed'] = np.mean(self.restless_history)

        # Check cooldown
        time_since_adjustment = current_time - self.last_adjustment_time
        result['cooldown_remaining'] = max(0, self.cooldown_seconds - time_since_adjustment)
        result['can_adjust'] = time_since_adjustment >= self.cooldown_seconds

        return result

    def record_adjustment(self, current_time: float = None):
        '''Record that a temperature adjustment was made.'''
        import time
        if current_time is None:
            current_time = time.time()
        self.last_adjustment_time = current_time

    def get_trend(self) -> str:
        '''Get trend direction of thermal comfort.'''
        if len(self.shiver_history) < 3:
            return 'insufficient_data'

        recent = np.mean(self.shiver_history[-2:])
        older = np.mean(self.shiver_history[:-2])

        if recent > older + 0.1:
            return 'getting_colder'
        elif recent < older - 0.1:
            return 'warming_up'
        else:
            return 'stable'
