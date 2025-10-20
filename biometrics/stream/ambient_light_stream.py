#!/usr/bin/env python3
"""
Continuous Ambient Light Monitoring
Reads lux values from OPT4001 sensor at regular intervals and stores them in the database.
"""

import time
import sys
import os
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('ambient_light_stream')

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ambient_light_sensor import OPT4001Sensor, insert_lux_reading

# Configuration
READING_INTERVAL = 60  # Read every 60 seconds
DB_PATH = '/persistent/free-sleep-data/free-sleep.db'


def monitor_ambient_light():
    """Continuously monitor and record ambient light levels."""
    sensor = OPT4001Sensor()
    logger.info('Starting continuous ambient light monitoring')
    logger.info(f'Reading interval: {READING_INTERVAL} seconds')

    consecutive_failures = 0
    last_success_time = None
    sensor_was_failing = False

    while True:
        try:
            # Read lux value
            lux = sensor.read_lux()

            if lux is not None:
                # Store in database
                timestamp = int(time.time())
                success = insert_lux_reading(DB_PATH, timestamp, lux)

                if success:
                    # Check if sensor recovered from failure
                    if sensor_was_failing:
                        logger.info(f'Sensor recovered! Recorded: {lux:.2f} lux (after {consecutive_failures} failures)')
                        sensor_was_failing = False
                    else:
                        logger.info(f'Recorded: {lux:.2f} lux')

                    consecutive_failures = 0
                    last_success_time = time.time()
                else:
                    logger.warning(f'Failed to store reading: {lux:.2f} lux')
            else:
                consecutive_failures += 1
                sensor_was_failing = True

                # Log with appropriate level based on failure count
                if consecutive_failures <= 3:
                    logger.error(f'Failed to read lux value from sensor (failure #{consecutive_failures})')
                    if consecutive_failures == 1:
                        logger.error(
                            'Troubleshooting tips:\n'
                            '  - Check I2C connections (SDA/SCL/GND/VCC)\n'
                            '  - Verify sensor power supply\n'
                            '  - Check I2C permissions: sudo usermod -a -G i2c $USER\n'
                            '  - Test I2C bus: i2cdetect -y 1'
                        )
                else:
                    # Reduce log spam after initial failures
                    logger.debug(f'Failed to read lux value from sensor (failure #{consecutive_failures})')

        except Exception as e:
            consecutive_failures += 1
            logger.error(f'Error in monitoring loop: {e}')

        # Calculate wait interval with exponential backoff
        if consecutive_failures == 0:
            wait_interval = READING_INTERVAL
        elif consecutive_failures < 3:
            wait_interval = READING_INTERVAL
        elif consecutive_failures < 10:
            wait_interval = 300  # 5 minutes
        else:
            wait_interval = 1800  # 30 minutes

        if consecutive_failures > 0 and consecutive_failures % 5 == 0:
            logger.info(f'Waiting {wait_interval}s before retry (consecutive failures: {consecutive_failures})')

        # Wait before next reading
        time.sleep(wait_interval)


if __name__ == '__main__':
    try:
        monitor_ambient_light()
    except KeyboardInterrupt:
        logger.info('Ambient light monitoring stopped by user')
    except Exception as e:
        logger.error(f'Fatal error in ambient light monitoring: {e}')
        sys.exit(1)
