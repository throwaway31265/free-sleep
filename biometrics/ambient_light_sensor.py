#!/usr/bin/env python3
"""
Ambient Light Sensor Reader for OPT4001
Reads lux values from the Texas Instruments OPT4001 sensor via I2C
and stores them in the database.
"""

import time
import sqlite3
import subprocess
import logging
from datetime import datetime
from typing import Optional

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('ambient_light_sensor')

# OPT4001 sensor configuration
I2C_BUS = 1  # Sensor is on I2C bus 1
I2C_ADDRESS = 0x44  # OPT4001 default address
RESULT_REGISTER = 0x00  # Register containing lux data
LUX_CONSTANT = 0.0004375  # Constant for lux calculation


class OPT4001Sensor:
    """Interface to read lux values from OPT4001 ambient light sensor."""

    def __init__(self, bus: int = I2C_BUS, address: int = I2C_ADDRESS):
        self.bus = bus
        self.address = address

    def read_raw_bytes(self) -> Optional[list[int]]:
        """Read 4 bytes from the OPT4001 result register."""
        try:
            # Use i2cget to read 4 bytes from register 0x00
            cmd = f'i2cget -y {self.bus} {self.address:#x} {RESULT_REGISTER:#x} i 4'
            result = subprocess.check_output(cmd, shell=True).decode().strip()

            # Parse hex values: "0x07 0x00 0x10 0x20" -> [7, 0, 16, 32]
            bytes_str = result.split()
            if len(bytes_str) < 4:
                logger.error(f'Insufficient bytes read from sensor: {result}')
                return None

            byte_vals = [int(b, 16) for b in bytes_str]
            return byte_vals

        except subprocess.CalledProcessError as e:
            logger.error(f'Failed to read from I2C sensor: {e}')
            return None
        except Exception as e:
            logger.error(f'Unexpected error reading sensor: {e}')
            return None

    def decode_lux(self, bytes_data: list[int]) -> float:
        """
        Decode 4 bytes from OPT4001 into lux value.

        Format:
        - Bytes 0-1: [exponent:4][mantissa_msb:12]
        - Bytes 2-3: [mantissa_lsb:8][counter:4][crc:4]

        Formula: lux = (mantissa << exponent) * LUX_CONSTANT
        """
        word1 = (bytes_data[0] << 8) | bytes_data[1]
        word2 = (bytes_data[2] << 8) | bytes_data[3]

        exponent = word1 >> 12
        mantissa_msb = word1 & 0xFFF
        mantissa_lsb = word2 >> 8

        # Combine into 20-bit mantissa
        full_mantissa = (mantissa_msb << 8) | mantissa_lsb

        # Calculate lux
        lux = (full_mantissa << exponent) * LUX_CONSTANT

        return lux

    def read_lux(self) -> Optional[float]:
        """Read and decode lux value from the sensor."""
        raw_bytes = self.read_raw_bytes()
        if raw_bytes is None:
            return None

        try:
            lux = self.decode_lux(raw_bytes)
            logger.debug(f'Read lux value: {lux:.2f}')
            return lux
        except Exception as e:
            logger.error(f'Failed to decode lux value: {e}')
            return None


def insert_lux_reading(db_path: str, timestamp: int, lux: float) -> bool:
    """Insert a lux reading into the database."""
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Let SQLite handle created_at with its default value
        cursor.execute('''
            INSERT INTO ambient_light_readings (timestamp, lux)
            VALUES (?, ?)
        ''', (timestamp, lux))

        conn.commit()
        conn.close()
        logger.debug(f'Inserted lux reading: {lux:.2f} at {timestamp}')
        return True

    except sqlite3.IntegrityError as e:
        logger.warning(f'Duplicate reading, skipping: {e}')
        return False
    except Exception as e:
        logger.error(f'Failed to insert lux reading: {e}')
        return False


def read_and_store_lux(db_path: str = '/persistent/free-sleep-data/free-sleep.db'):
    """Read lux from sensor and store in database."""
    sensor = OPT4001Sensor()

    lux = sensor.read_lux()
    if lux is None:
        logger.error('Failed to read lux value from sensor')
        return False

    timestamp = int(time.time())
    success = insert_lux_reading(db_path, timestamp, lux)

    if success:
        logger.info(f'Successfully recorded: {lux:.2f} lux at {datetime.fromtimestamp(timestamp)}')

    return success


if __name__ == '__main__':
    import sys

    db_path = '/persistent/free-sleep-data/free-sleep.db'
    if len(sys.argv) > 1:
        db_path = sys.argv[1]

    logger.info('Starting ambient light sensor reading')
    read_and_store_lux(db_path)
