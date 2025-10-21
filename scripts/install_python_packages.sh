#!/bin/bash

set -e  # Exit on error

PYTHON_VERSION_DOT=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}{sys.version_info.minor}")')

# Determine the correct Python library directory
if [ "$PYTHON_VERSION" = "39" ]; then
    PYTHON_LIB_DIR="/usr/lib/python${PYTHON_VERSION_DOT}"
else
    PYTHON_LIB_DIR="/usr/lib64/python${PYTHON_VERSION_DOT}"
fi

# Copy venv module files if they exist and aren't already present
VENV_SOURCE="/home/dac/free-sleep/scripts/python/$PYTHON_VERSION/venv"
if [ -d "$VENV_SOURCE" ]; then
    if [ ! -d "$PYTHON_LIB_DIR/venv" ]; then
        echo "Copying venv module files for Python $PYTHON_VERSION_DOT..."
        cp -r "$VENV_SOURCE" "$PYTHON_LIB_DIR/" || echo "Warning: Failed to copy venv files, but continuing..."
    else
        echo "venv module already exists in $PYTHON_LIB_DIR"
    fi
else
    echo "Warning: venv source directory not found at $VENV_SOURCE"
    echo "Attempting to create virtual environment anyway..."
fi

# Create virtual environment
echo "Creating virtual environment at /home/dac/venv..."
python3 -m venv /home/dac/venv

# Verify venv was created successfully
if [ ! -f "/home/dac/venv/bin/activate" ]; then
    echo "Error: Virtual environment creation failed!"
    exit 1
fi

# Activate and install packages
echo "Installing Python packages..."
source /home/dac/venv/bin/activate
/home/dac/venv/bin/python -m pip install --upgrade pip
/home/dac/venv/bin/python -m pip install numpy scipy pandas cbor2 watchdog

echo "Python packages installed successfully!"

