"""Forward room and bed temperature readings from the local NATS bus to the free-sleep server.

The reader uses core NATS subscriptions only (no JetStream consumers), so it never writes
to /persistent. Every 30 s it posts one merged sample to /api/metrics/environment, which
autopilot uses for room compensation. Failures here never reach stream.py or vitals.
"""

import asyncio
import json
import logging
from pathlib import Path
import sys
import time
from typing import Any, Dict, Optional, Tuple
import urllib.request

# The service runs this file directly, so make the shared biometrics helpers importable.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from nats_client import is_nats_running, load_nats_client  # noqa: E402

NATS_URL = 'nats://127.0.0.1:4222'
BEDTEMP_SUBJECT = 'raw.sens.bedtemp'
THERM_SUBJECT = 'raw.frz.therm'
ENVIRONMENT_URL = 'http://127.0.0.1:3000/api/metrics/environment'

POST_INTERVAL_S = 30
POST_TIMEOUT_S = 3
MAX_MESSAGE_AGE_S = 60
# At boot the firmware's NATS server may bind after this unit starts; keep probing this long
# before concluding the pod has no NATS (a clean exit is never restarted by systemd).
NATS_WAIT_S = 300
NATS_PROBE_INTERVAL_S = 10

SIDES = ('left', 'right')
# CBOR channel key -> payload key for each side of raw.sens.bedtemp.
BED_CHANNELS = (('side', 'sideC'), ('out', 'outC'), ('cen', 'cenC'), ('in', 'inC'))

# Inclusive validity ranges; values outside them are dropped (sent as null).
AMBIENT_RANGE_C = (5.0, 40.0)
HUMIDITY_RANGE = (0.0, 100.0)
SURFACE_RANGE_C = (5.0, 50.0)
POWER_RANGE = (-1.0, 1.0)
# Sanity bounds only: the spec does not constrain these, they just reject garbage readings.
MCU_RANGE_C = (0.0, 100.0)
THERM_TARGET_RANGE_C = (0.0, 60.0)

logger = logging.getLogger('free-sleep-environment')

# Latest decoded message per subject plus the time it arrived (epoch seconds).
LatestMessage = Tuple[Dict[str, Any], float]


def _number(value: Any) -> Optional[float]:
    """Return value as a float when it is a real number (bools and strings are rejected)."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value)


def in_range(value: Optional[float], bounds: Tuple[float, float]) -> Optional[float]:
    """Keep a value only when it falls inside the inclusive bounds."""
    if value is None:
        return None
    lower, upper = bounds
    return value if lower <= value <= upper else None


def scaled(value: Any, bounds: Tuple[float, float], divisor: float = 1.0) -> Optional[float]:
    """Convert a raw reading (e.g. centi-degC with divisor 100) and range-check it."""
    number = _number(value)
    if number is None:
        return None
    return in_range(round(number / divisor, 2), bounds)


def message_timestamp(message: Dict[str, Any], received_at: float) -> float:
    """Use the message's own epoch ts when present; fall back to the arrival time."""
    ts_value = _number(message.get('ts'))
    return ts_value if ts_value is not None else received_at


def is_fresh(message_ts: float, now: float) -> bool:
    """A message is usable for MAX_MESSAGE_AGE_S seconds (clock jumps either way count as stale)."""
    return abs(now - message_ts) <= MAX_MESSAGE_AGE_S


def empty_bed() -> Dict[str, Dict[str, Optional[float]]]:
    return {side: {payload_key: None for _, payload_key in BED_CHANNELS} for side in SIDES}


def empty_therm() -> Dict[str, Dict[str, Optional[float]]]:
    return {side: {'targetC': None, 'power': None} for side in SIDES}


def decode_bedtemp(message: Dict[str, Any]) -> Dict[str, Any]:
    """Map a raw.sens.bedtemp message (centi-degC / centi-%RH) to payload fields in C and %RH."""
    bed = empty_bed()
    for side in SIDES:
        channels = message.get(side)
        if not isinstance(channels, dict):
            continue
        for cbor_key, payload_key in BED_CHANNELS:
            bed[side][payload_key] = scaled(channels.get(cbor_key), SURFACE_RANGE_C, 100)
    return {
        'ambientC': scaled(message.get('amb'), AMBIENT_RANGE_C, 100),
        'humidity': scaled(message.get('hu'), HUMIDITY_RANGE, 100),
        'mcuC': scaled(message.get('mcu'), MCU_RANGE_C, 100),
        'bed': bed,
    }


def decode_therm(message: Dict[str, Any]) -> Dict[str, Dict[str, Optional[float]]]:
    """Map a raw.frz.therm message (target already in C, power -1..1, negative = cooling)."""
    therm = empty_therm()
    for side in SIDES:
        values = message.get(side)
        if not isinstance(values, dict):
            continue
        therm[side]['targetC'] = scaled(values.get('target'), THERM_TARGET_RANGE_C)
        therm[side]['power'] = scaled(values.get('power'), POWER_RANGE)
    return therm


def build_sample(
    bedtemp: Optional[LatestMessage],
    therm: Optional[LatestMessage],
    now: float,
) -> Dict[str, Any]:
    """Merge the latest messages into one payload; stale or missing sources become nulls."""
    sample: Dict[str, Any] = {
        'ts': int(now),
        'ambientC': None,
        'humidity': None,
        'mcuC': None,
        'bed': empty_bed(),
        'therm': empty_therm(),
    }
    if bedtemp is not None:
        message, received_at = bedtemp
        if is_fresh(message_timestamp(message, received_at), now):
            sample.update(decode_bedtemp(message))
    if therm is not None:
        message, received_at = therm
        if is_fresh(message_timestamp(message, received_at), now):
            sample['therm'] = decode_therm(message)
    return sample


def has_any_value(sample: Dict[str, Any]) -> bool:
    """True when at least one measurement survived filtering (ts alone does not count)."""
    if any(sample[key] is not None for key in ('ambientC', 'humidity', 'mcuC')):
        return True
    for group in ('bed', 'therm'):
        for side_values in sample[group].values():
            if any(value is not None for value in side_values.values()):
                return True
    return False


def post_sample(sample: Dict[str, Any]) -> None:
    """POST the sample to the server; raises on network or HTTP errors."""
    request = urllib.request.Request(
        ENVIRONMENT_URL,
        data=json.dumps(sample).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    with urllib.request.urlopen(request, timeout=POST_TIMEOUT_S) as response:
        response.read()


async def run_reader() -> None:
    """Subscribe to the sensor subjects and post a merged sample every POST_INTERVAL_S."""
    import cbor2

    nats, _ = load_nats_client()
    latest: Dict[str, LatestMessage] = {}

    async def on_message(msg) -> None:
        try:
            decoded = cbor2.loads(msg.data)
        except Exception as error:
            logger.warning(f'Failed to decode {msg.subject} message: {error}')
            return
        if isinstance(decoded, dict):
            latest[msg.subject] = (decoded, time.time())

    connection = await nats.connect(NATS_URL, max_reconnect_attempts=-1)
    logger.info(f'Connected to {NATS_URL}; subscribing to {BEDTEMP_SUBJECT} and {THERM_SUBJECT}')
    try:
        await connection.subscribe(BEDTEMP_SUBJECT, cb=on_message)
        await connection.subscribe(THERM_SUBJECT, cb=on_message)
        while True:
            await asyncio.sleep(POST_INTERVAL_S)
            if connection.is_closed:
                raise RuntimeError('NATS connection closed')
            sample = build_sample(latest.get(BEDTEMP_SUBJECT), latest.get(THERM_SUBJECT), time.time())
            if not has_any_value(sample):
                logger.warning('No fresh environment readings; skipping post')
                continue
            try:
                # urllib blocks, so keep it off the event loop that services NATS pings.
                await asyncio.to_thread(post_sample, sample)
            except Exception as error:
                logger.warning(f'Failed to post environment sample: {error}')
    finally:
        if not connection.is_closed:
            await connection.close()


def configure_logging() -> None:
    # journald captures stdout; it adds its own timestamps, so keep the line short.
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter('%(levelname)-8s | %(message)s'))
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False


def wait_for_nats(wait_s: float = NATS_WAIT_S, interval_s: float = NATS_PROBE_INTERVAL_S,
                  probe=is_nats_running, sleep=time.sleep, clock=time.monotonic) -> bool:
    """Probe NATS until it answers or wait_s passes; True as soon as it is reachable."""
    deadline = clock() + wait_s
    while True:
        if probe():
            return True
        if clock() >= deadline:
            return False
        logger.info(f'NATS not reachable yet; retrying in {interval_s:.0f} s')
        sleep(interval_s)


def main() -> None:
    configure_logging()
    if not wait_for_nats():
        # A clean exit stops the unit (Restart=on-failure) on pods without a NATS sensor bus.
        logger.info(f'NATS did not answer within {NATS_WAIT_S} s; environment reader is not needed on this pod. Exiting.')
        sys.exit(0)
    try:
        load_nats_client()
    except RuntimeError as error:
        # Missing nats-py is fixed by an update, not by restarting every 30 s.
        logger.error(str(error))
        sys.exit(0)
    try:
        asyncio.run(run_reader())
    except KeyboardInterrupt:
        logger.info('Environment reader stopped')
    except Exception as error:
        logger.error(f'Environment reader failed: {error!r}')
        sys.exit(1)


if __name__ == '__main__':
    main()
