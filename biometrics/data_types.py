from typing import TypedDict, Literal, List, Tuple
from datetime import datetime
from numpy import ndarray, float64, ma, int64
from typing import TypedDict, Union

# endregion
Side = Literal['left', 'right']
RawDataTypes = Literal['bedTemp', 'capSense', 'frzTemp', 'log', 'piezo-dual']


# ---------------------------------------------------------------------------------------------------
# See all the different logs in ./decoded_raw_data_samples/logs.json

class LogData(TypedDict):
    type: str
    ts: str
    level: str
    msg: str
    seq: int


# ---------------------------------------------------------------------------------------------------
# Piezo sensor data (used for heart rates, hrv - ???)

class PiezoDualData(TypedDict):
    type: str
    ts: str
    freq: int
    adc: int
    gain: int
    left1: ndarray
    left2: ndarray
    right1: ndarray
    right2: ndarray
    seq: int


# {
#     "adc": 1,
#     "freq": 500,
#     "gain": 400,
#     "left1": [
#         -160889, -163532, -161494, -162596, -163266, -163120, -163281,   ...... (500 values)
#     ],
#     "left2": [
#         -4788, -4841, -7013, -6902, -9195, -9662, -11273, -9883, -11415, ...... (500 values)
#     ],
#     "right1": [
#         544338, 543290, 540837, 541583, 541184, 539035, 538201, 537129,  ...... (500 values)
#     ],
#     "right2": [
#         722955, 723792, 724770, 727022, 727501, 728404, 728542, 728296,  ...... (500 values)
#     ],
#     "seq": 1610681,
#     "ts": "2025-01-10 11:00:22",
#     "type": "piezo-dual"
# }

# ---------------------------------------------------------------------------------------------------
# Capacitance sensor - Used for presence detection (I think)

CapSenseChannel = TypedDict('CapSenseChannel', {
    'out': int,
    'cen': int,
    'in': int,
    'status': str
})


class CapSenseData(TypedDict):
    type: str
    ts: str
    left: CapSenseChannel
    right: CapSenseChannel
    seq: int


# {
#   "type": "capSense",
#   "ts": "2025-01-10 11:00:22",
#   "left": {
#     "out": 387,
#     "cen": 381,
#     "in": 505,
#     "status": "good"
#   },
#   "right": {
#     "out": 1076,
#     "cen": 1075,
#     "in": 1074,
#     "status": "good"
#   },
#   "seq": 1610679
# }

# ---------------------------------------------------------------------------------------------------
# Freeze temps - Temperature measurements

class FrzTempData(TypedDict):
    type: str
    ts: str
    left: int
    right: int
    amb: int
    hs: int
    seq: int


BedTempChannel = TypedDict('BedTempChannel', {
    'side': int,
    'out': int,
    'cen': int,
    'in': int
})


class BedTempData(TypedDict):
    type: str
    ts: str
    amb: int
    mcu: int
    hu: int
    left: BedTempChannel
    right: BedTempChannel
    seq: int


# {
#     "amb": 2168,
#     "hs": 3168,
#     "left": 1975,
#     "right": 1981,
#     "seq": 1610686,
#     "ts": "2025-01-10 11:00:28",
#     "type": "frzTemp"
# }

# ---------------------------------------------------------------------------------------------------


class RawRow(TypedDict):
    seq: int
    data: bytes


class Data(TypedDict):
    bed_temps: List[BedTempData]
    cap_senses: List[CapSenseData]
    freeze_temps: List[FrzTempData]
    logs: List[LogData]
    piezo_dual: List[PiezoDualData]

    errors: List[dict]


class SleepRecord(TypedDict):
    side: str
    entered_bed_at: datetime
    left_bed_at: datetime
    sleep_period_seconds: int
    times_exited_bed: int
    present_intervals: List[Tuple[datetime, datetime]]
    not_present_intervals: List[Tuple[datetime, datetime]]


class Baseline(TypedDict):
    mean: float
    std: float


class CapBaseline(TypedDict):
    left_out: Baseline
    left_cen: Baseline
    left_in: Baseline
    right_out: Baseline
    right_cen: Baseline
    right_in: Baseline


class HeartPyMeasurement(TypedDict):
    bpm: Union[float64, float]
    ibi: Union[float64, float]
    sdnn: Union[float64, float]
    sdsd: Union[float64, float, str]  # 'masked' is a string
    rmssd: Union[float64, float]
    pnn20: Union[float64, float]
    pnn50: Union[float64, float]
    hr_mad: Union[float64, float]
    sd1: Union[float64, float]
    sd2: Union[float64, float]
    s: Union[float64, float]
    sd1_sd2: Union[float64, float]  # Renamed "sd1/sd2" to a valid key
    breathingrate: Union[float64, float]


class Measurement(TypedDict):
    side: Side
    timestamp: int
    heart_rate: Union[float64, float]
    hrv: Union[float64, float]
    breathing_rate: Union[float64, float]


class PoincareData(TypedDict):
    x_plus: ndarray
    x_minus: ndarray
    x_one: ndarray
    x_two: ndarray


class WorkingData(TypedDict):
    hr: ndarray
    sample_rate: int
    peaklist: ndarray
    ybeat: List[float64]
    rolling_mean: ndarray
    RR_list: ndarray
    RR_indices: List[Tuple[int64, int64]]
    RR_diff: ma.MaskedArray
    RR_sqdiff: ma.MaskedArray
    rrsd: float64
    best_ma_perc: int
    removed_beats: ndarray
    removed_beats_y: ndarray
    binary_peaklist: ndarray
    RR_masklist: List[int]
    RR_list_cor: ndarray
    RR_masked: ma.MaskedArray
    nn20: ma.MaskedArray
    nn50: ma.MaskedArray
    poincare: PoincareData
