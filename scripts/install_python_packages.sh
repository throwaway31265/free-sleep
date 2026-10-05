#!/bin/sh
set -eu

# Reuse existing environments during updates; bootstrap Python only on first install.
if [ ! -x /home/dac/venv/bin/python ]; then
  PYTHON_VERSION_DOT=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
  PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}{sys.version_info.minor}")')

  if [ "$PYTHON_VERSION" = "39" ]; then
    echo "Detected python version 3.9"
    # Pod 3 with SD card has python version 3.9 & is missing venv.
    cp -r /home/dac/free-sleep/scripts/python/$PYTHON_VERSION/venv /usr/lib/python$PYTHON_VERSION_DOT/
    cp /home/dac/free-sleep/scripts/python/plistlib.py /usr/lib/python$PYTHON_VERSION_DOT/
    cp /home/dac/free-sleep/scripts/python/pyexpat.cpython-$PYTHON_VERSION-aarch64-linux-gnu.so /usr/lib/python$PYTHON_VERSION_DOT/
    echo "Copied files for Pod 3 with SD card successfully."
  elif [ "$PYTHON_VERSION" = "310" ]; then
    echo "Detected python version 3.10"
    cp /home/dac/free-sleep/scripts/python/plistlib.py /usr/lib64/python$PYTHON_VERSION_DOT/
    cp /home/dac/free-sleep/scripts/python/pyexpat.cpython-$PYTHON_VERSION-aarch64-linux-gnu.so /usr/lib64/python$PYTHON_VERSION_DOT/
    echo "Copied files successfully"
  else
    echo "WARNING: Detected Python $PYTHON_VERSION_DOT; biometrics may not work on this version."
  fi

  echo "Creating new Python venv..."
  python3 -m venv /home/dac/venv
fi

set -x
echo "Synchronizing biometrics Python dependencies..."
# No --upgrade: keep installed versions unless a requirement needs a change.
exec /home/dac/venv/bin/python -m pip install --disable-pip-version-check \
  -r /home/dac/free-sleep/biometrics/requirements.txt
set +x
