# Biometrics

## Stream Processor - Calculates vitals (`stream/`)

- `stream.py`: Monitors the latest `.RAW` file and continuously processes biometric data.
- `stream_processor.py`: Buffers piezoelectric sensor data for presence detection and biometric calculations.
- `biometric_processor.py`: Processes real-time piezo data to extract heart rate, HRV, and breathing rate.

## Sleep Detection (`sleep_detection/`)

- `calibrate_sensor_thresholds.py`: Establishes a baseline for capacitance sensors.
- `analyze_sleep.py`: Processes raw data and detects sleep intervals.
- `cap_data.py`: Loads and processes capacitance sensor data to detect presence.
- `sleep_detector.py`: Merges piezo and capacitance presence data to determine sleep sessions.

## Vital Signs Calculation (`vitals/`)

- `calculate_vitals.py`: Loads piezo data, estimates heart rate, HRV, and breathing rate.
- `calculations.py`: Implements signal processing, filtering, and biometric estimation.
- `run_data.py`: Manages runtime parameters for sliding window calculations.

## Database Management (`db.py`)

- Handles SQLite database operations for storing sleep records and vitals.
- Uses `sqlite3` with a persistent connection and WAL mode for performance.
- Provides functions for inserting vitals and sleep records while avoiding duplicates.

## Raw Data Handling (`load_raw_files.py`)

- Loads `.RAW` files from the pod, decodes CBOR-encoded data, and extracts piezo and capacitance sensor readings.
- Filters data based on timestamps and sensor types.
- Implements memory optimization techniques such as garbage collection.

## Data Types (`data_types.py`)

- Defines structured data models (`TypedDict`) for various biometric readings.
- Includes schemas for heart rate, HRV, breathing rate, and sensor readings.

## Piezo Data Processing (`piezo_data.py`)

- Loads and processes piezo sensor data for biometric calculations.
- Detects presence using a rolling window method based on sensor range thresholds.
- Identifies baseline periods for calibrating the system.

## Data Sources

- There's 2 main sensors used to measure biometrics, they're both available in /persistent/*.RAW files
- This data is only available if the Pod cannot access the internet. You can block internet access to the pod by setting
  up firewall rules
- The raw files are encoded in cbor & can be loaded with `load_raw_files.py`

### 1. Capacitance sensor data

- Legacy Pod 3/4 firmware writes `capSense`, with three integer channels per side.
- New Pod 5 firmware writes `capSense2` version 1, with eight floats per side in
  `values`. `capacitance.py` adapts it before filtering in both RAW and NATS loaders.
  The first three adjacent pairs are averaged into `out`, `cen`, and `in`; the
  final reference-like pair is excluded. This is an empirical compatibility
  mapping, also used by [Nightstand](https://github.com/LTimothy/nightstand/blob/main/biometrics/load_raw_files.py),
  rather than a documented physical sensor layout.
- Valid Pod 5 readings sharing a second are averaged before merging with piezo
  data, so rolling windows keep their one-row-per-second timing. Bad status,
  missing pairs, negative placeholders, and nonfinite sensor values are excluded
  independently for each side. Legacy values and row handling are preserved.
- Calibration retains the legacy standard-deviation floor of `5`; Pod 5 uses a
  separate initial floor of `1` in its smaller native units. Its actual baseline
  mean and standard deviation are measured from the empty-bed window. The Pod 5
  floor follows the [existing implementation's measured starting point](https://github.com/LTimothy/nightstand/blob/main/biometrics/sleep_detection/cap_data.py)
  and still needs validation on recordings with known occupancy from more beds.
- Existing untagged baseline JSON files remain valid for legacy firmware. Pod 5
  baselines store `format`, `version`, and `channels`; a format mismatch requires
  recalibration. Mixed-format time windows are rejected to avoid mixing units.
  Calibration requires a stable five-minute window with at least 80% valid rows;
  insufficient data leaves the previous baseline file intact.

- Legacy sample:

```json
{
  "type": "capSense",
  "ts": "2025-01-10 11:00:22",
  "left": {
    "out": 387,
    "cen": 381,
    "in": 505,
    "status": "good"
  },
  "right": {
    "out": 1076,
    "cen": 1075,
    "in": 1074,
    "status": "good"
  },
  "seq": 1610679
}
```

Pod 5 sample (before normalization):

```json
{
  "type": "capSense2",
  "version": 1,
  "ts": 1761860556,
  "left": {
    "values": [12.633, 12.638, 13.074, 13.090, 15.312, 15.294, 1.171, 1.174],
    "status": "good"
  },
  "right": {
    "values": [12.892, 12.881, 12.227, 12.225, 16.112, 16.126, 1.209, 1.207],
    "status": "good"
  }
}
```

### 2. Piezo sensor data

- This measures pressure 500x a second
- Pod 3 has 2 piezo sensors, Pod 4 has 1 piezo sensor

```json
{
  "adc": 1,
  "freq": 500,
  "gain": 400,
  "left1": [
    -163532,
    -161494
    //  ...500 more
  ],
  "left2": [
    -59995,
    -63199
    //  ...500 more
  ],
  "right1": [
    81464,
    80593
    //  ...500 more
  ],
  "right2": [
    722955,
    723792
    //  ...500 more
  ],
  "seq": 1610681,
  "ts": "2025-01-10 11:00:22",
  "type": "piezo-dual"
}
```



