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

    while True:
        try:
            # Read lux value
            lux = sensor.read_lux()

            if lux is not None:
                # Store in database
                timestamp = int(time.time())
                success = insert_lux_reading(DB_PATH, timestamp, lux)

                if success:
                    logger.info(f'Recorded: {lux:.2f} lux')
                else:
                    logger.warning(f'Failed to store reading: {lux:.2f} lux')
            else:
                logger.error('Failed to read lux value from sensor')

        except Exception as e:
            logger.error(f'Error in monitoring loop: {e}')

        # Wait before next reading
        time.sleep(READING_INTERVAL)


if __name__ == '__main__':
    try:
        monitor_ambient_light()
    except KeyboardInterrupt:
        logger.info('Ambient light monitoring stopped by user')
    except Exception as e:
        logger.error(f'Fatal error in ambient light monitoring: {e}')
        sys.exit(1)
