'''
BCG (Ballistocardiogram) optimized peak detection using template matching.

Standard ECG/PPG algorithms (rolling mean threshold) perform poorly on BCG signals because:
1. Respiratory motion dominates the raw signal (~0.2 Hz vs cardiac ~1 Hz)
2. BCG morphology differs from ECG R-peaks
3. Motion artifacts are more prevalent

This module implements:
1. Cardiac bandpass filtering (2-8 Hz) to isolate heartbeat signal
2. Hilbert envelope for initial peak detection
3. Template matching via cross-correlation for precise peak localization
4. MAD-based robust outlier rejection for RR intervals
'''

import numpy as np
from scipy import signal
from scipy.signal import hilbert
from typing import Tuple, Optional
from data_types import WorkingData, HeartPyMeasurement

__all__ = [
    'bcg_extract_cardiac',
    'bcg_detect_peaks_envelope',
    'bcg_estimate_hr_autocorr',
    'bcg_detect_peaks_zero_crossing',
    'bcg_build_template',
    'bcg_detect_peaks_template',
    'bcg_filter_rr_intervals',
    'bcg_spectral_hrv',
    'bcg_process',
    'bcg_process_dual_channel',
    'bcg_calculate_confidence',
    'bcg_detect_motion',
    'bcg_detect_presence',
    'bcg_detect_shivering',
]


def bcg_extract_cardiac(
    data: np.ndarray,
    sample_rate: int,
    lowcut: float = 2.0,
    highcut: float = 8.0,
    order: int = 4
) -> np.ndarray:
    '''
    Extract cardiac component from BCG signal using bandpass filter.

    The cardiac band (2-8 Hz) contains the heartbeat signal while filtering out:
    - Respiratory motion (<0.5 Hz)
    - High frequency noise and muscle artifacts (>10 Hz)

    Parameters
    ----------
    data : np.ndarray
        Raw BCG signal (e.g., from piezo sensor)
    sample_rate : int
        Sample rate in Hz
    lowcut : float
        Lower cutoff frequency (default 2.0 Hz)
    highcut : float
        Upper cutoff frequency (default 8.0 Hz)
    order : int
        Butterworth filter order (default 4)

    Returns
    -------
    cardiac : np.ndarray
        Filtered cardiac signal
    '''
    nyq = 0.5 * sample_rate
    low = lowcut / nyq
    high = highcut / nyq

    # Ensure cutoffs are valid
    low = max(0.01, min(low, 0.99))
    high = max(low + 0.01, min(high, 0.99))

    b, a = signal.butter(order, [low, high], btype='band')
    cardiac = signal.filtfilt(b, a, data)

    return cardiac


def bcg_detect_peaks_envelope(
    cardiac: np.ndarray,
    sample_rate: int,
    min_distance_ms: float = 550,
    prominence_factor: float = 0.3
) -> np.ndarray:
    '''
    Detect peaks using Hilbert envelope method.

    This is used for initial peak estimation before template matching refinement.

    Parameters
    ----------
    cardiac : np.ndarray
        Cardiac-filtered BCG signal
    sample_rate : int
        Sample rate in Hz
    min_distance_ms : float
        Minimum distance between peaks in milliseconds (default 500ms = 120 bpm max)
    prominence_factor : float
        Peak prominence as fraction of signal std (default 0.3)

    Returns
    -------
    peaks : np.ndarray
        Array of peak indices
    '''
    # Compute analytic signal envelope
    analytic = hilbert(cardiac)
    envelope = np.abs(analytic)

    # Find peaks with minimum distance constraint
    min_samples = int(min_distance_ms * sample_rate / 1000)
    prominence = np.std(envelope) * prominence_factor

    peaks, _ = signal.find_peaks(
        envelope,
        distance=min_samples,
        prominence=prominence
    )

    return peaks


def bcg_estimate_hr_autocorr(
    data: np.ndarray,
    sample_rate: int,
    min_bpm: int = 50,
    max_bpm: int = 120
) -> Tuple[float, float]:
    '''
    Estimate heart rate using autocorrelation of narrowly filtered signal.

    This provides a robust initial estimate of the heartbeat period,
    which can be used to constrain peak detection.

    Parameters
    ----------
    data : np.ndarray
        Raw or filtered BCG signal
    sample_rate : int
        Sample rate in Hz
    min_bpm : int
        Minimum expected heart rate (default 50)
    max_bpm : int
        Maximum expected heart rate (default 120)

    Returns
    -------
    hr : float
        Estimated heart rate in bpm
    period_ms : float
        Estimated period in milliseconds
    '''
    # Use narrow bandpass for HR estimation (cardiac fundamental)
    filtered = bcg_extract_cardiac(data, sample_rate, lowcut=0.8, highcut=3.0)

    n = min(len(filtered), int(15 * sample_rate))  # Use up to 15 seconds
    autocorr = np.correlate(filtered[:n], filtered[:n], mode='full')
    autocorr = autocorr[len(autocorr)//2:]
    autocorr = autocorr / (autocorr[0] + 1e-10)

    # Search for peak in valid HR range
    min_lag = int(60 / max_bpm * sample_rate)
    max_lag = int(60 / min_bpm * sample_rate)

    search = autocorr[min_lag:min(max_lag, len(autocorr))]
    if len(search) == 0:
        return 70.0, 857.0  # Default ~70 bpm

    peak_idx = np.argmax(search) + min_lag
    period_ms = peak_idx / sample_rate * 1000
    hr = 60000 / period_ms

    return hr, period_ms


def bcg_detect_peaks_zero_crossing(
    data: np.ndarray,
    sample_rate: int,
    estimated_period_ms: float = None,
    min_bpm: int = 50,
    max_bpm: int = 120
) -> np.ndarray:
    '''
    Detect heartbeats using zero-crossing method on narrowly filtered signal.

    Zero-crossings are more robust to amplitude variations than peak detection.
    The narrow bandpass (0.8-2.5 Hz) isolates the cardiac fundamental frequency,
    producing a quasi-sinusoidal signal where each cardiac cycle corresponds
    to one zero-crossing cycle.

    This method is preferred over envelope-based detection because:
    1. It's insensitive to amplitude variations from respiration/motion
    2. The narrow filter removes high-frequency artifacts
    3. Zero-crossings are more temporally consistent than peaks

    Parameters
    ----------
    data : np.ndarray
        Raw BCG signal (will be filtered internally)
    sample_rate : int
        Sample rate in Hz
    estimated_period_ms : float, optional
        Expected heartbeat period in ms (if None, will be estimated)
    min_bpm : int
        Minimum expected heart rate (default 50)
    max_bpm : int
        Maximum expected heart rate (default 120)

    Returns
    -------
    peaks : np.ndarray
        Array of detected heartbeat indices (at positive zero-crossings)
    '''
    # Estimate period if not provided
    if estimated_period_ms is None:
        _, estimated_period_ms = bcg_estimate_hr_autocorr(data, sample_rate, min_bpm, max_bpm)

    # Narrow bandpass to get quasi-sinusoidal cardiac signal
    # 0.8-2.5 Hz captures the cardiac fundamental (50-150 bpm = 0.83-2.5 Hz)
    cardiac = bcg_extract_cardiac(data, sample_rate, lowcut=0.8, highcut=2.5)

    # Find all zero crossings
    zero_crossings = np.where(np.diff(np.signbit(cardiac)))[0]

    # Keep only positive-going (negative to positive) crossings
    # These correspond to the start of each cardiac cycle
    pos_crossings = []
    for zc in zero_crossings:
        if zc > 0 and zc < len(cardiac) - 1:
            if cardiac[zc] <= 0 and cardiac[zc + 1] > 0:
                pos_crossings.append(zc)

    pos_crossings = np.array(pos_crossings)

    if len(pos_crossings) < 3:
        return pos_crossings

    # Filter crossings based on expected rhythm
    expected_samples = int(estimated_period_ms * sample_rate / 1000)
    tolerance = int(expected_samples * 0.35)  # 35% tolerance

    # Keep crossings that fit expected rhythm
    filtered_crossings = [pos_crossings[0]]

    for i in range(1, len(pos_crossings)):
        interval = pos_crossings[i] - filtered_crossings[-1]

        # Accept if close to expected period
        if abs(interval - expected_samples) < tolerance:
            filtered_crossings.append(pos_crossings[i])
        # Or if it's roughly 2x (missed one crossing)
        elif abs(interval - 2 * expected_samples) < tolerance:
            # Interpolate missing crossing
            missing = filtered_crossings[-1] + expected_samples
            filtered_crossings.append(int(missing))
            filtered_crossings.append(pos_crossings[i])

    return np.array(sorted(set(filtered_crossings)))


def bcg_build_template(
    cardiac: np.ndarray,
    peaks: np.ndarray,
    sample_rate: int,
    template_width_ms: float = 300,
    skip_edge_beats: int = 5
) -> Optional[np.ndarray]:
    '''
    Build median beat template from detected peaks.

    The template captures the characteristic BCG waveform shape for this session,
    which is then used for precise peak localization via cross-correlation.

    Parameters
    ----------
    cardiac : np.ndarray
        Cardiac-filtered BCG signal
    peaks : np.ndarray
        Initial peak indices from envelope detection
    sample_rate : int
        Sample rate in Hz
    template_width_ms : float
        Total template width in milliseconds (default 300ms = 150ms each side)
    skip_edge_beats : int
        Number of beats to skip at start/end (default 5)

    Returns
    -------
    template : np.ndarray or None
        Median beat template, or None if insufficient beats
    '''
    template_half = int((template_width_ms / 2) * sample_rate / 1000)

    # Need at least some beats after skipping edges
    if len(peaks) < (2 * skip_edge_beats + 3):
        return None

    templates = []
    for p in peaks[skip_edge_beats:-skip_edge_beats]:
        # Skip if too close to signal edges
        if p < template_half or p >= len(cardiac) - template_half:
            continue

        beat = cardiac[p - template_half:p + template_half]

        # Normalize each beat (zero mean, unit variance)
        beat_std = np.std(beat)
        if beat_std > 1e-10:
            beat = (beat - np.mean(beat)) / beat_std
            templates.append(beat)

    if len(templates) < 3:
        return None

    # Median template is robust to outlier beats
    template = np.median(templates, axis=0)

    return template


def bcg_detect_peaks_template(
    cardiac: np.ndarray,
    template: np.ndarray,
    sample_rate: int,
    min_distance_ms: float = 450,
    correlation_threshold: float = 0.3
) -> np.ndarray:
    '''
    Detect peaks using template matching via cross-correlation.

    This provides much more precise peak localization than envelope detection
    by matching the actual beat morphology.

    Parameters
    ----------
    cardiac : np.ndarray
        Cardiac-filtered BCG signal
    template : np.ndarray
        Beat template from bcg_build_template()
    sample_rate : int
        Sample rate in Hz
    min_distance_ms : float
        Minimum distance between peaks in milliseconds (default 450ms = 133 bpm max)
    correlation_threshold : float
        Minimum correlation height for peak detection (default 0.3)

    Returns
    -------
    peaks : np.ndarray
        Array of refined peak indices
    '''
    # Normalize template
    template_norm = (template - np.mean(template)) / (np.std(template) + 1e-10)

    # Cross-correlate template with signal
    # Normalize by template length for comparable correlation values
    corr = signal.correlate(cardiac, template_norm, mode='same') / len(template)

    # Find peaks in correlation signal
    min_samples = int(min_distance_ms * sample_rate / 1000)

    peaks, properties = signal.find_peaks(
        corr,
        distance=min_samples,
        height=correlation_threshold
    )

    return peaks


def bcg_filter_rr_intervals(
    rr_intervals: np.ndarray,
    min_rr_ms: float = 600,
    max_rr_ms: float = 1100,
    mad_threshold: float = 1.5
) -> Tuple[np.ndarray, np.ndarray]:
    '''
    Filter RR intervals using MAD (Median Absolute Deviation) based outlier rejection.

    MAD is more robust than standard deviation for outlier detection because
    it's not influenced by extreme values.

    Parameters
    ----------
    rr_intervals : np.ndarray
        Raw RR intervals in milliseconds
    min_rr_ms : float
        Minimum physiologically valid RR interval (default 400ms = 150 bpm)
    max_rr_ms : float
        Maximum physiologically valid RR interval (default 1500ms = 40 bpm)
    mad_threshold : float
        Number of MADs from median for outlier rejection (default 3.0)

    Returns
    -------
    rr_filtered : np.ndarray
        Filtered RR intervals
    mask : np.ndarray
        Boolean mask where True = valid interval
    '''
    # First pass: physiological bounds
    mask = (rr_intervals >= min_rr_ms) & (rr_intervals <= max_rr_ms)
    rr_bounded = rr_intervals[mask]

    if len(rr_bounded) < 3:
        return rr_intervals, np.ones(len(rr_intervals), dtype=bool)

    # Second pass: MAD-based outlier rejection
    median = np.median(rr_bounded)
    mad = np.median(np.abs(rr_bounded - median))

    # MAD scale factor for normal distribution equivalence
    mad_scaled = mad * 1.4826  # ~= std for normal distribution

    if mad_scaled > 1e-10:
        deviation = np.abs(rr_intervals - median)
        mask = mask & (deviation < mad_threshold * mad_scaled)

    rr_filtered = rr_intervals[mask]

    return rr_filtered, mask


def bcg_spectral_hrv(
    rr_intervals: np.ndarray,
    resample_fs: float = 4.0
) -> dict:
    '''
    Calculate frequency-domain HRV metrics from RR intervals.

    Computes power in standard HRV frequency bands:
    - VLF (Very Low Frequency): 0.003-0.04 Hz
    - LF (Low Frequency): 0.04-0.15 Hz - sympathetic + parasympathetic
    - HF (High Frequency): 0.15-0.4 Hz - parasympathetic (vagal) activity

    The LF/HF ratio indicates autonomic balance:
    - Low ratio (<1): Parasympathetic dominance (relaxation, sleep)
    - High ratio (>2): Sympathetic dominance (stress, exercise)

    Parameters
    ----------
    rr_intervals : np.ndarray
        RR intervals in milliseconds
    resample_fs : float
        Resampling frequency for uniform time series (default 4 Hz)

    Returns
    -------
    metrics : dict
        Dictionary containing:
        - vlf_power, lf_power, hf_power: Band powers in ms²
        - lf_hf_ratio: LF/HF power ratio
        - lf_norm, hf_norm: Normalized powers (%)
        - total_power: Total spectral power
    '''
    if len(rr_intervals) < 10:
        return {
            'vlf_power': np.nan,
            'lf_power': np.nan,
            'hf_power': np.nan,
            'lf_hf_ratio': np.nan,
            'lf_norm': np.nan,
            'hf_norm': np.nan,
            'total_power': np.nan
        }

    # Convert to seconds and create cumulative time
    rr_seconds = rr_intervals / 1000
    cumulative_time = np.cumsum(rr_seconds)

    # Interpolate to uniform time series
    t_uniform = np.arange(0, cumulative_time[-1], 1/resample_fs)
    if len(t_uniform) < 10:
        return {
            'vlf_power': np.nan,
            'lf_power': np.nan,
            'hf_power': np.nan,
            'lf_hf_ratio': np.nan,
            'lf_norm': np.nan,
            'hf_norm': np.nan,
            'total_power': np.nan
        }

    rr_interp = np.interp(t_uniform, cumulative_time, rr_seconds)

    # Detrend (remove mean)
    rr_detrend = rr_interp - np.mean(rr_interp)

    # Compute PSD using Welch's method
    nperseg = min(256, len(rr_detrend))
    freqs, psd = signal.welch(rr_detrend, fs=resample_fs, nperseg=nperseg)

    # HRV frequency bands (standard definitions)
    vlf_band = (0.003, 0.04)
    lf_band = (0.04, 0.15)
    hf_band = (0.15, 0.4)

    def band_power(freqs, psd, band):
        mask = (freqs >= band[0]) & (freqs < band[1])
        if not np.any(mask):
            return 0.0
        return np.trapezoid(psd[mask], freqs[mask])

    vlf = band_power(freqs, psd, vlf_band)
    lf = band_power(freqs, psd, lf_band)
    hf = band_power(freqs, psd, hf_band)

    total = vlf + lf + hf
    lf_hf_sum = lf + hf

    return {
        'vlf_power': vlf * 1e6,  # Convert to ms²
        'lf_power': lf * 1e6,
        'hf_power': hf * 1e6,
        'lf_hf_ratio': lf / hf if hf > 1e-10 else np.nan,
        'lf_norm': (lf / lf_hf_sum * 100) if lf_hf_sum > 1e-10 else np.nan,
        'hf_norm': (hf / lf_hf_sum * 100) if lf_hf_sum > 1e-10 else np.nan,
        'total_power': total * 1e6
    }


def bcg_process(
    data: np.ndarray,
    sample_rate: int,
    lowcut: float = 2.0,
    highcut: float = 8.0,
    calculate_breathing: bool = True,
    bpmmin: int = 40,
    bpmmax: int = 150,
) -> Tuple[WorkingData, HeartPyMeasurement]:
    '''
    Process BCG signal to extract heart rate and HRV metrics.

    This is the main entry point for BCG analysis, replacing the HeartPy
    process() function for piezo sensor data.

    Parameters
    ----------
    data : np.ndarray
        Raw BCG signal (e.g., piezo sensor data)
    sample_rate : int
        Sample rate in Hz
    lowcut : float
        Cardiac bandpass lower cutoff (default 2.0 Hz)
    highcut : float
        Cardiac bandpass upper cutoff (default 8.0 Hz)
    calculate_breathing : bool
        Whether to calculate breathing rate (default True)
    bpmmin : int
        Minimum valid heart rate (default 40 bpm)
    bpmmax : int
        Maximum valid heart rate (default 150 bpm)

    Returns
    -------
    working_data : WorkingData
        Dictionary containing intermediate analysis data
    measures : HeartPyMeasurement
        Dictionary containing computed metrics (bpm, sdnn, rmssd, etc.)
    '''
    from heart.analysis import calc_breathing

    measures: HeartPyMeasurement = {}
    working_data: WorkingData = {}

    # Store original data
    working_data['hr'] = data
    working_data['sample_rate'] = sample_rate

    # Step 1: Extract cardiac component (for visualization/compatibility)
    cardiac = bcg_extract_cardiac(data, sample_rate, lowcut, highcut)
    working_data['cardiac_filtered'] = cardiac

    # Step 2: Peak detection via zero-crossing method
    # Zero-crossing on narrowly filtered signal (0.8-2.5 Hz) is more robust
    # than envelope detection, which is sensitive to motion artifacts.
    # The narrow filter isolates the cardiac fundamental frequency.
    peaks = bcg_detect_peaks_zero_crossing(data, sample_rate, min_bpm=bpmmin, max_bpm=bpmmax)

    if len(peaks) < 10:
        # Not enough peaks for reliable analysis
        measures['bpm'] = np.nan
        measures['sdnn'] = np.nan
        measures['rmssd'] = np.nan
        return working_data, measures

    working_data['peaklist'] = peaks
    working_data['ybeat'] = cardiac[peaks]

    # Step 5: Calculate RR intervals
    rr_raw = np.diff(peaks) / sample_rate * 1000  # Convert to milliseconds
    working_data['RR_list_raw'] = rr_raw

    # Step 6: Filter RR intervals
    min_rr = 60000 / bpmmax  # Convert bpm to ms
    max_rr = 60000 / bpmmin
    rr_filtered, rr_mask = bcg_filter_rr_intervals(rr_raw, min_rr, max_rr)

    working_data['RR_list'] = rr_raw
    working_data['RR_list_cor'] = rr_filtered
    working_data['RR_masklist'] = ~rr_mask  # Inverted: 1 = rejected

    if len(rr_filtered) < 3:
        measures['bpm'] = np.nan
        measures['sdnn'] = np.nan
        measures['rmssd'] = np.nan
        return working_data, measures

    # Step 7: Calculate time-domain HRV metrics
    measures['bpm'] = 60000 / np.mean(rr_filtered)
    measures['sdnn'] = np.std(rr_filtered)
    measures['ibi'] = np.mean(rr_filtered)

    # RMSSD: Root Mean Square of Successive Differences
    rr_diff = np.diff(rr_filtered)
    measures['rmssd'] = np.sqrt(np.mean(rr_diff ** 2))
    measures['sdsd'] = np.std(rr_diff)

    # pNN20 and pNN50
    nn20 = np.sum(np.abs(rr_diff) > 20)
    nn50 = np.sum(np.abs(rr_diff) > 50)
    measures['pnn20'] = nn20 / len(rr_diff) if len(rr_diff) > 0 else np.nan
    measures['pnn50'] = nn50 / len(rr_diff) if len(rr_diff) > 0 else np.nan

    # Store for compatibility
    working_data['RR_diff'] = rr_diff
    working_data['RR_sqdiff'] = rr_diff ** 2

    # Step 8: Calculate frequency-domain HRV metrics (LF/HF power)
    spectral_metrics = bcg_spectral_hrv(rr_filtered)
    measures.update(spectral_metrics)

    # Step 9: Calculate breathing rate from RR variability
    if calculate_breathing and len(rr_filtered) > 10:
        try:
            measures, working_data = calc_breathing(
                rr_filtered,
                measures,
                working_data,
                method='welch'
            )
        except:
            measures['breathingrate'] = np.nan
    else:
        measures['breathingrate'] = np.nan

    return working_data, measures


def bcg_process_dual_channel(
    left_data: np.ndarray,
    right_data: np.ndarray,
    sample_rate: int,
    **kwargs
) -> Tuple[WorkingData, HeartPyMeasurement]:
    '''
    Process dual-channel BCG data and select the better quality signal.

    Compares both channels and uses the one with lower SDNN (less noise).

    Parameters
    ----------
    left_data : np.ndarray
        Left channel piezo data
    right_data : np.ndarray
        Right channel piezo data
    sample_rate : int
        Sample rate in Hz
    **kwargs
        Additional arguments passed to bcg_process()

    Returns
    -------
    working_data : WorkingData
        Analysis data from the selected channel
    measures : HeartPyMeasurement
        Computed metrics from the selected channel
    '''
    # Process both channels
    wd_left, m_left = bcg_process(left_data, sample_rate, **kwargs)
    wd_right, m_right = bcg_process(right_data, sample_rate, **kwargs)

    # Select channel with lower SDNN (less noisy detection)
    sdnn_left = m_left.get('sdnn', np.inf)
    sdnn_right = m_right.get('sdnn', np.inf)

    if np.isnan(sdnn_left):
        sdnn_left = np.inf
    if np.isnan(sdnn_right):
        sdnn_right = np.inf

    # Normal sleep SDNN should be 30-100ms
    # Lower is generally better (less detection noise)
    # But too low (<20ms) might indicate poor detection

    def sdnn_quality(sdnn):
        if sdnn < 20 or sdnn > 150:
            return float('inf')  # Poor quality
        return abs(sdnn - 50)  # Closer to 50ms is better

    if sdnn_quality(sdnn_left) <= sdnn_quality(sdnn_right):
        wd_left['selected_channel'] = 'left'
        return wd_left, m_left
    else:
        wd_right['selected_channel'] = 'right'
        return wd_right, m_right


def bcg_calculate_confidence(
    hr: float,
    sdnn: float,
    n_peaks: int = None,
    rr_rejection_rate: float = None,
) -> Tuple[str, float]:
    '''
    Calculate confidence score for BCG heart rate measurement.

    Based on signal quality metrics from piezo sensor only.
    Note: LPS sensor measures pressure/movement, NOT BCG heartbeat,
    so it cannot be used for HR cross-validation.

    Parameters
    ----------
    hr : float
        Heart rate from piezo sensor (bpm)
    sdnn : float
        SDNN from piezo sensor (ms) - key quality indicator
    n_peaks : int, optional
        Number of peaks detected (more = better)
    rr_rejection_rate : float, optional
        Fraction of RR intervals rejected (lower = better)

    Returns
    -------
    confidence : str
        Confidence level: 'high', 'medium', 'low', or 'invalid'
    score : float
        Numeric confidence score (0.0 to 1.0)
    '''
    # Handle invalid readings
    if np.isnan(hr):
        return 'invalid', 0.0

    score = 1.0

    # SDNN is the primary quality indicator
    # Normal sleep SDNN: 30-80ms
    # Too high (>120ms) suggests noisy detection
    # Too low (<20ms) suggests poor detection or very unusual physiology
    if np.isnan(sdnn):
        score *= 0.5
    elif sdnn > 150:
        score *= 0.4  # Very noisy
    elif sdnn > 100:
        score *= 0.7  # Somewhat noisy
    elif sdnn < 20:
        score *= 0.6  # Unusually low
    elif 30 <= sdnn <= 80:
        score *= 1.0  # Ideal range

    # HR physiological plausibility
    if hr < 40 or hr > 120:
        score *= 0.5  # Unlikely during sleep
    elif hr < 50 or hr > 100:
        score *= 0.8  # Possible but less common

    # Number of peaks (if provided)
    if n_peaks is not None:
        if n_peaks < 20:
            score *= 0.5  # Too few for reliable stats
        elif n_peaks < 40:
            score *= 0.8

    # RR rejection rate (if provided)
    if rr_rejection_rate is not None:
        if rr_rejection_rate > 0.5:
            score *= 0.4  # Most intervals rejected = bad signal
        elif rr_rejection_rate > 0.3:
            score *= 0.7

    # Determine confidence level
    if score >= 0.8:
        confidence = 'high'
    elif score >= 0.5:
        confidence = 'medium'
    else:
        confidence = 'low'

    return confidence, min(1.0, score)


def bcg_detect_motion(
    lps_data: np.ndarray,
    sample_rate: int,
    window_seconds: float = 2.0,
    motion_threshold: float = 2.0,
) -> Tuple[np.ndarray, np.ndarray]:
    '''
    Detect motion/movement from LPS (pressure/accelerometer) sensor data.

    Useful for:
    - Detecting bed entry/exit for temperature scheduling
    - Identifying motion artifacts to reject bad HR windows
    - Detecting position changes

    Parameters
    ----------
    lps_data : np.ndarray
        Raw LPS sensor data
    sample_rate : int
        Sample rate in Hz
    window_seconds : float
        Window size for variance calculation (default 2.0s)
    motion_threshold : float
        Number of MADs above median variance to flag as motion (default 2.0)

    Returns
    -------
    motion_mask : np.ndarray
        Boolean array, True where motion detected (per-window)
    variance_trace : np.ndarray
        Variance in each window (useful for visualization)
    '''
    window_samples = int(window_seconds * sample_rate)

    if len(lps_data) < window_samples:
        return np.array([False]), np.array([0.0])

    # Calculate variance in sliding windows
    n_windows = len(lps_data) // window_samples
    variances = []

    for i in range(n_windows):
        start = i * window_samples
        end = start + window_samples
        window = lps_data[start:end].astype(float)

        # High-pass filter to remove DC drift
        window = window - np.mean(window)

        # Variance captures motion energy
        variances.append(np.var(window))

    variances = np.array(variances)

    if len(variances) < 3:
        return np.zeros(len(variances), dtype=bool), variances

    # MAD-based threshold for motion detection
    median_var = np.median(variances)
    mad_var = np.median(np.abs(variances - median_var))

    if mad_var < 1e-10:
        # Very stable signal - no motion
        return np.zeros(len(variances), dtype=bool), variances

    # Flag windows with variance significantly above median
    threshold = median_var + motion_threshold * mad_var * 1.4826
    motion_mask = variances > threshold

    return motion_mask, variances


def bcg_detect_presence(
    lps_data: np.ndarray,
    sample_rate: int,
    window_seconds: float = 5.0,
    presence_threshold: float = 0.1,
) -> Tuple[bool, float]:
    '''
    Detect if someone is present in bed using LPS sensor.

    Useful for temperature scheduling - only heat/cool when occupied.

    Parameters
    ----------
    lps_data : np.ndarray
        Raw LPS sensor data
    sample_rate : int
        Sample rate in Hz
    window_seconds : float
        Window size for analysis (default 5.0s)
    presence_threshold : float
        Minimum relative variance for presence detection (default 0.1)

    Returns
    -------
    present : bool
        True if someone appears to be in bed
    confidence : float
        Confidence in the presence detection (0.0 to 1.0)
    '''
    window_samples = int(window_seconds * sample_rate)
    data = lps_data[-window_samples:].astype(float) if len(lps_data) >= window_samples else lps_data.astype(float)

    if len(data) < sample_rate:  # Need at least 1 second
        return False, 0.0

    # Remove DC
    data = data - np.mean(data)

    # Calculate signal characteristics
    variance = np.var(data)
    peak_to_peak = np.max(data) - np.min(data)

    # Extract cardiac band to look for heartbeat
    try:
        cardiac = bcg_extract_cardiac(data, sample_rate)
        cardiac_power = np.var(cardiac)
    except:
        cardiac_power = 0.0

    # Empty bed has very low variance and no cardiac signal
    # Occupied bed has measurable variance from breathing/heartbeat

    # Normalize by expected range (sensor-dependent, may need tuning)
    # These thresholds work for typical LPS sensors
    if variance < 1e-6:
        return False, 0.9  # Very confident no one there

    # Check for cardiac activity
    cardiac_ratio = cardiac_power / (variance + 1e-10)

    if cardiac_ratio > 0.01:
        # Clear cardiac signal detected
        return True, 0.9
    elif variance > presence_threshold * 1e6:  # Adjust based on sensor scale
        # Some activity but no clear cardiac - might be motion or edge of bed
        return True, 0.5
    else:
        return False, 0.6


def bcg_detect_shivering(
    piezo_data: np.ndarray,
    sample_rate: int,
    window_seconds: float = 5.0,
    shiver_low: float = 6.0,
    shiver_high: float = 14.0,
    threshold_ratio: float = 2.0,
) -> Tuple[np.ndarray, np.ndarray]:
    '''
    Detect shivering from piezo sensor by analyzing the 6-14 Hz frequency band.

    Shivering produces rhythmic muscle contractions at 8-12 Hz, distinct from:
    - Breathing (~0.2-0.3 Hz)
    - Heartbeat (~1 Hz)
    - Gross movement (broadband noise)

    This can help distinguish "too cold" from "too warm" during sleep.

    Parameters
    ----------
    piezo_data : np.ndarray
        Raw piezo sensor data
    sample_rate : int
        Sample rate in Hz (typically 500 Hz for piezo)
    window_seconds : float
        Analysis window size (default 5.0s)
    shiver_low : float
        Lower bound of shivering frequency band (default 6.0 Hz)
    shiver_high : float
        Upper bound of shivering frequency band (default 14.0 Hz)
    threshold_ratio : float
        Ratio of shiver band power to baseline for detection (default 2.0)

    Returns
    -------
    shiver_mask : np.ndarray
        Boolean array, True where shivering detected (per window)
    shiver_power : np.ndarray
        Relative power in shivering band (higher = more shivering)
    '''
    from scipy.fft import fft, fftfreq

    window_samples = int(window_seconds * sample_rate)

    if len(piezo_data) < window_samples:
        return np.array([False]), np.array([0.0])

    n_windows = len(piezo_data) // window_samples
    shiver_power = []

    for i in range(n_windows):
        start = i * window_samples
        end = start + window_samples
        window = piezo_data[start:end].astype(float)

        # Remove DC offset
        window = window - np.mean(window)

        # Compute power spectrum via FFT
        freqs = fftfreq(len(window), 1/sample_rate)
        fft_vals = np.abs(fft(window))**2

        # Only positive frequencies
        pos_mask = freqs > 0
        freqs = freqs[pos_mask]
        fft_vals = fft_vals[pos_mask]

        # Power in shivering band vs high frequency noise floor
        shiver_band = (freqs >= shiver_low) & (freqs <= shiver_high)
        noise_band = (freqs >= 20) & (freqs <= 50)

        power_shiver = np.mean(fft_vals[shiver_band]) if np.any(shiver_band) else 0
        power_noise = np.mean(fft_vals[noise_band]) if np.any(noise_band) else 1

        # Ratio: high value = distinct peak in shiver band
        ratio = power_shiver / (power_noise + 1e-10)
        shiver_power.append(ratio)

    shiver_power = np.array(shiver_power)

    # Detect shivering when power ratio exceeds threshold above median
    baseline = np.median(shiver_power)
    shiver_mask = shiver_power > baseline * threshold_ratio

    return shiver_mask, shiver_power
