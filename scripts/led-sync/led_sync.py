#!/usr/bin/env python3
"""Front LED sync for Pod 3 hubs running the 2021 Capybara.

The newer Eight Sleep Capybara colors the hub's front LED by thermostat state (cool = aqua,
heat = red, idle = white). The 2021 Capybara only shows connectivity (white = online). This
daemon reproduces the newer behaviour on the IS31FL3194 LED driver (I2C bus 1, address 0x53),
using the same thermostat input (/persistent/heat/state1.dat written by frankenfirmware), the
same colors and the same brightness scaling, and re-asserts periodically because the old
Capybara rewrites the LED whenever its connectivity state changes or it restarts.

Python 3.9 stdlib only. Must run as root (/dev/i2c-1 is root-only).
"""
import fcntl
import json
import os
import signal
import struct
import subprocess
import sys
import time
import urllib.request

I2C_SLAVE = 0x0703
LED_ADDRESS = 0x53
REG_OPERATING_CONFIG = 0x01
REG_OUTPUT_ENABLE = 0x02
REG_CURRENT_BAND = 0x03
REG_OUT_BLUE = 0x10
REG_OUT_RED = 0x21
REG_OUT_GREEN = 0x32
REG_COLOR_UPDATE = 0x40
LATCH = 0xC5
WHITE = (255, 255, 255)


def env_rgb(name, default):
    """Parse 'R,G,B' from the environment, falling back to the default on bad input."""
    raw = os.environ.get(name, '')
    try:
        parts = tuple(int(part) for part in raw.split(','))
        if len(parts) == 3 and all(0 <= part <= 255 for part in parts):
            return parts
    except ValueError:
        pass
    return default


CONFIG = {
    'enabled': os.environ.get('LED_SYNC_ENABLED', '1') == '1',
    'poll_s': float(os.environ.get('POLL_S', '3')),
    'reassert_s': float(os.environ.get('REASSERT_S', '10')),
    'cool_rgb': env_rgb('COOL_RGB', (0, 255, 255)),
    'heat_rgb': env_rgb('HEAT_RGB', (255, 16, 16)),
    'idle_rgb': env_rgb('IDLE_RGB', WHITE),
    'cool_threshold_c': float(os.environ.get('COOL_THRESHOLD_C', '27.0')),
    'color_logic': os.environ.get('COLOR_LOGIC', 'stock'),
    'state_file': os.environ.get('STATE_FILE', '/persistent/heat/state1.dat'),
    'api': os.environ.get('API', 'http://127.0.0.1:3000/api/deviceStatus'),
    'yield_when_offline': os.environ.get('YIELD_WHEN_OFFLINE', '1') == '1',
    'dry_run': os.environ.get('DRY_RUN', '0') == '1',
}


def log(message):
    print(f'[led-sync] {message}', flush=True)


def read_state_file(path, now):
    """Decode frankenfirmware's heat state: big-endian u32 [ver, expL, expR, modeL, modeR, tL*100, tR*100].

    Returns {'left': {'on', 'target_c'}, 'right': {...}} or None if missing/invalid.
    """
    try:
        with open(path, 'rb') as handle:
            data = handle.read(28)
    except OSError:
        return None
    if len(data) < 28:
        return None
    version, exp_left, exp_right, mode_left, mode_right, temp_left, temp_right = struct.unpack('>7I', data)
    if version != 2:
        return None
    return {
        'left': {'on': mode_left == 1 and exp_left > now, 'target_c': temp_left / 100.0, 'current_c': None},
        'right': {'on': mode_right == 1 and exp_right > now, 'target_c': temp_right / 100.0, 'current_c': None},
    }


def fahrenheit_to_c(value):
    return None if value is None else (value - 32.0) * 5.0 / 9.0


def read_api(url):
    """Fetch free-sleep deviceStatus; returns the parsed JSON or None."""
    try:
        with urllib.request.urlopen(url, timeout=2) as response:
            return json.load(response)
    except Exception:  # noqa: BLE001 - any failure just means "no API data this tick"
        return None


def sides_from_api(status):
    sides = {}
    for side in ('left', 'right'):
        info = status.get(side) or {}
        sides[side] = {
            'on': bool(info.get('isOn')),
            'target_c': fahrenheit_to_c(info.get('targetTemperatureF')),
            'current_c': fahrenheit_to_c(info.get('currentTemperatureF')),
        }
    return sides


def thermostat_mode(sides, cfg):
    """Return 'idle', 'cooling' or 'heating' exactly like the newer Capybara (cooling wins on disagreement).

    stock:     an ON side is cooling when its target is <= the 27 C threshold.
    direction: an ON side is cooling when its target is below its current temperature.
    """
    on_sides = [side for side in sides.values() if side['on'] and side['target_c'] is not None]
    if not on_sides:
        return 'idle'

    def is_cooling(side):
        if cfg['color_logic'] == 'direction' and side['current_c'] is not None:
            return side['target_c'] < side['current_c']
        return not side['target_c'] > cfg['cool_threshold_c']

    return 'cooling' if any(is_cooling(side) for side in on_sides) else 'heating'


def scale(rgb, brightness):
    """Stock scales value (HSV V) to brightness; for these full-saturation colors that is int(channel*b)."""
    brightness = max(0.0, min(1.0, brightness))
    return tuple(int(channel * brightness) for channel in rgb)


def is_online():
    """Treat the pod as online unless nmcli clearly reports less than full connectivity."""
    try:
        result = subprocess.run(['nmcli', '-t', '-f', 'CONNECTIVITY', 'general'],
                                capture_output=True, text=True, timeout=3)
        state = result.stdout.strip()
        return state in ('', 'full', 'unknown')
    except Exception:  # noqa: BLE001 - missing nmcli or timeout: assume online
        return True


def capybara_pid():
    try:
        result = subprocess.run(['pidof', 'Eight.Capybara'], capture_output=True, text=True, timeout=3)
        return result.stdout.strip() or None
    except Exception:  # noqa: BLE001
        return None


class Led:
    """Minimal IS31FL3194 solid-color writer (same register sequence as Capybara's RgbLed.Set)."""

    def __init__(self, dry_run):
        self.dry_run = dry_run
        self.fd = None

    def _open(self):
        self.fd = os.open('/dev/i2c-1', os.O_RDWR)
        fcntl.ioctl(self.fd, I2C_SLAVE, LED_ADDRESS)
        # Same current bands / output enable Capybara configures at startup (idempotent; no reset).
        os.write(self.fd, bytes([REG_CURRENT_BAND, 0x2A]))
        os.write(self.fd, bytes([REG_OUTPUT_ENABLE, 0x07]))

    def write_solid(self, rgb):
        red, green, blue = rgb
        if self.dry_run:
            log(f'DRY_RUN would write solid R{red} G{green} B{blue}')
            return True
        try:
            if self.fd is None:
                self._open()
            for register, value in ((REG_OPERATING_CONFIG, 0x01), (REG_OUT_BLUE, blue), (REG_OUT_RED, red),
                                    (REG_OUT_GREEN, green), (REG_COLOR_UPDATE, LATCH)):
                os.write(self.fd, bytes([register, value]))
            return True
        except OSError as error:
            log(f'i2c write failed: {error}')
            self.close()
            return False

    def close(self):
        if self.fd is not None:
            try:
                os.close(self.fd)
            except OSError:
                pass
            self.fd = None


def main():
    cfg = CONFIG
    if not cfg['enabled']:
        log('LED_SYNC_ENABLED=0 - exiting without touching the LED')
        return 0

    led = Led(cfg['dry_run'])
    running = {'value': True}

    def stop(_signum, _frame):
        running['value'] = False

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    log(f'starting (logic={cfg["color_logic"]}, cool={cfg["cool_rgb"]}, heat={cfg["heat_rgb"]}, dry_run={cfg["dry_run"]})')

    brightness = 1.0
    last_rgb = None
    last_mode = None
    last_write = 0.0
    known_pid = capybara_pid()
    pid_changed_at = None

    while running['value']:
        now = time.time()
        status = read_api(cfg['api'])
        if status is not None:
            settings = status.get('settings') or {}
            if isinstance(settings.get('ledBrightness'), (int, float)):
                brightness = settings['ledBrightness'] / 100.0

        sides = read_state_file(cfg['state_file'], now)
        if sides is None and status is not None:
            sides = sides_from_api(status)
        elif sides is not None and status is not None and cfg['color_logic'] == 'direction':
            for side, api_side in sides_from_api(status).items():
                sides[side]['current_c'] = api_side['current_c']

        priming = bool(status and status.get('isPriming'))
        mode = 'idle' if sides is None or priming else thermostat_mode(sides, cfg)
        base = {'cooling': cfg['cool_rgb'], 'heating': cfg['heat_rgb']}.get(mode, cfg['idle_rgb'])
        rgb = scale(base, brightness)

        pid = capybara_pid()
        if pid != known_pid:
            known_pid = pid
            pid_changed_at = now  # give a restarted Capybara 5 s to finish its own LED init
        capybara_settling = pid_changed_at is not None and now - pid_changed_at < 5
        if pid_changed_at is not None and not capybara_settling:
            pid_changed_at = None
            last_rgb = None  # force a rewrite right after Capybara's init

        if cfg['yield_when_offline'] and not is_online():
            last_rgb = None  # let Capybara's connectivity alert show
        elif not capybara_settling and (rgb != last_rgb or now - last_write >= cfg['reassert_s']):
            if led.write_solid(rgb):
                if mode != last_mode or rgb != last_rgb:
                    log(f'{mode} -> R{rgb[0]} G{rgb[1]} B{rgb[2]} (brightness {brightness:.2f})')
                last_rgb, last_mode, last_write = rgb, mode, now
            else:
                last_rgb = None

        slept = 0.0
        while running['value'] and slept < cfg['poll_s']:
            time.sleep(0.25)
            slept += 0.25

    # Hand the LED back looking like the old Capybara's "connected" state.
    led.write_solid(WHITE)
    led.close()
    log('stopped; LED restored to white')
    return 0


if __name__ == '__main__':
    sys.exit(main())
