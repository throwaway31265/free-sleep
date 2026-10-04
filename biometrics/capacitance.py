"""Adapt firmware capacitance formats to the three channels used by sleep detection."""

from dataclasses import dataclass
import math
from numbers import Real
from typing import Optional


@dataclass(frozen=True)
class CapacitanceFormat:
    name: str
    version: Optional[int]
    min_std: float


LEGACY_CAP_FORMAT = CapacitanceFormat('capSense', None, 5.0)
# Pod 5 reports small floats instead of legacy counts. Keep its noise floor separate.
POD5_CAP_FORMAT = CapacitanceFormat('capSense2', 1, 1.0)
CAP_CHANNELS = ('out', 'cen', 'in')


def _normalize_pod5_side(channel: object) -> dict:
    """Average the first three sensor pairs; exclude the final reference-like pair."""
    invalid = dict.fromkeys(CAP_CHANNELS)
    invalid['status'] = 'invalid'
    if not isinstance(channel, dict) or channel.get('status') != 'good':
        return invalid

    values = channel.get('values')
    if not isinstance(values, (list, tuple)) or len(values) != 8:
        return invalid
    # Negative placeholders, nonfinite readings and partial pairs are not measurements.
    if any(
        not isinstance(value, Real) or isinstance(value, bool)
        or not math.isfinite(value) or value < 0
        for value in values[:6]
    ):
        return invalid

    normalized = {
        name: (values[index * 2] + values[index * 2 + 1]) / 2
        for index, name in enumerate(CAP_CHANNELS)
    }
    normalized['status'] = 'good'
    return normalized


def normalize_capacitance_record(record: dict) -> dict:
    """Leave legacy records intact and adapt supported Pod 5 records before filtering."""
    if record.get('type') != POD5_CAP_FORMAT.name:
        return record
    if type(record.get('version')) is not int or record['version'] != POD5_CAP_FORMAT.version:
        raise ValueError(f"Unsupported capSense2 version: {record.get('version')!r}")

    return {
        **record,
        'type': LEGACY_CAP_FORMAT.name,
        'cap_format': POD5_CAP_FORMAT.name,
        'left': _normalize_pod5_side(record.get('left')),
        'right': _normalize_pod5_side(record.get('right')),
    }


def get_capacitance_format(records: list) -> CapacitanceFormat:
    """Prevent calibration or detection from mixing incompatible sensor units."""
    formats = set()
    for record in records:
        name = record.get('cap_format', LEGACY_CAP_FORMAT.name)
        if name == LEGACY_CAP_FORMAT.name:
            formats.add(LEGACY_CAP_FORMAT)
        elif name == POD5_CAP_FORMAT.name and record.get('version') == POD5_CAP_FORMAT.version:
            formats.add(POD5_CAP_FORMAT)
        else:
            raise ValueError(f'Unsupported capacitance format: {name!r}')
    if len(formats) > 1:
        raise ValueError('Mixed capacitance formats; select a time window from one firmware format.')
    return next(iter(formats), LEGACY_CAP_FORMAT)
