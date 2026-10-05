"""Load the NATS client only on Pods that use a local NATS sensor stream."""

import socket


def is_nats_running(host='127.0.0.1', port=4222, timeout=2):
    """Probe the local server without requiring nats-py on legacy RAW-file Pods."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def load_nats_client():
    """Give NATS users a repair instruction while keeping legacy readers importable."""
    try:
        import nats
        from nats.js import api
    except ImportError as error:
        raise RuntimeError(
            'NATS sensor data requires nats-py in /home/dac/venv. '
            'Update Free Sleep to synchronize biometrics dependencies, or run '
            '/home/dac/venv/bin/python -m pip install nats-py with internet access enabled.'
        ) from error
    return nats, api
