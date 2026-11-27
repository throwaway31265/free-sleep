import traceback
from typing import Literal, get_args, Optional, Tuple, List
import platform
import logging
from logging.handlers import RotatingFileHandler
from datetime import datetime
import os
import sys
import urllib.request
import json

import sentry_sdk


LoggerName = Literal['sleep-analyzer', 'calibrate-sensor', 'free-sleep-stream']
LOGGER_NAMES: List[LoggerName] = list(get_args(LoggerName))


class BaseLogger(logging.Logger):
    date: str
    start_time: str
    folder_path: str
    env: Literal['local', 'prod']

    def __init__(self, name):
        super().__init__(name)

    def runtime(self):
        return str(datetime.now() - datetime.strptime(self.start_time, '%Y-%m-%d %H:%M:%S'))

    def error(self, msg, *args, **kwargs):
        super().error(msg, *args, **kwargs)
        if isinstance(msg, Exception):
            # Explicit (type, value, tb) form works on Python 3.9 (Pod 3) as well as 3.10+.
            formatted = ''.join(traceback.format_exception(type(msg), msg, msg.__traceback__))
            super().error(formatted, *args, **kwargs)


def _get_logger_instance(name: str = None) -> Tuple[BaseLogger, LoggerName]:
    if name is None:
        loggers = list(logging.root.manager.loggerDict.keys())
        for name in LOGGER_NAMES:
            if name in loggers:
                logger: BaseLogger= logging.getLogger(name)
                return logger, name
        raise Exception('Default logger not found!')

    logger: BaseLogger= logging.getLogger(name)
    return logger, name



def _get_log_level():
    return logging.INFO if os.getenv('LOG_LEVEL') == 'INFO' else logging.DEBUG


class FixedWidthFormatter(logging.Formatter):
    def format(self, record):
        # Format timestamp
        timestamp = self.formatTime(record, datefmt='%Y-%m-%d %H:%M:%S')

        # Fixed-width formatting for LEVEL (8 chars) and FILE:LINE (30 chars)
        level = f"{record.levelname:<8}"
        file_info = f"{record.filename}:{record.lineno}"
        file_info_padded = f"{file_info:<40}"  # Left-align to 40 chars

        # Combine formatted parts
        formatted_message = f"{timestamp} UTC | {level} | {file_info_padded} | {record.getMessage()}"
        return formatted_message


FORMATTER = FixedWidthFormatter()


def _get_file_handler(data_folder_path: str, name: str):
    folder_path = f'{data_folder_path}logs/'

    if not os.path.isdir(folder_path):
        os.makedirs(folder_path)

    handler = RotatingFileHandler(
        filename=f"{folder_path}/{name}.log",
        mode='a',
        maxBytes=10 * 1024 * 1024,  # 10MB max file size
        backupCount=0,  # No rotation, just truncate when max size is reached
        encoding="utf-8",
    )
    handler.setFormatter(FORMATTER)
    return handler


def _get_console_handler():
    handler = logging.StreamHandler()
    handler.setLevel(logging.DEBUG)
    # Use the custom FixedWidthFormatter
    handler.setFormatter(FORMATTER)
    return handler


def _build_logger(logger: BaseLogger, name: LoggerName):
    logger.date = datetime.now().strftime('%Y-%m-%d')
    logger.start_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    logger.propagate = False
    if platform.system().lower() == 'linux':
        logger.env = 'prod'
        logger.folder_path = '/persistent/free-sleep-data/'
    else:
        logger.env = 'local'
        logger.folder_path = '/Users/ds/free-sleep/server/free-sleep-data/'

    logger.setLevel(logging.DEBUG)
    logger.addHandler(_get_console_handler())
    logger.addHandler(_get_file_handler(logger.folder_path, name))





def _load_sentry_tags():
    try:
        sentry_tags = {
            "user_id": "error",
            "branch": "error",
            "version": "error",
            "hubVersion": "error",
            "coverVersion": "error",
        }
        settings_db_file_path = '/persistent/free-sleep-data/lowdb/settingsDB.json'
        if os.path.isfile(settings_db_file_path):
            print('Loading settingsDB.json...')
            with open(settings_db_file_path) as file:
                settings = json.load(file)
            sentry_tags['user_id'] = settings['id']

        server_info_file_path = '/home/dac/free-sleep/server/src/serverInfo.json'
        if os.path.isfile(server_info_file_path):
            print('Loading serverInfo.json...')

            with open(server_info_file_path) as file:
                server_info = json.load(file)

            sentry_tags['version'] = server_info['version']
            sentry_tags['branch'] = server_info['branch']


        with urllib.request.urlopen("http://127.0.0.1:3000/api/deviceStatus", timeout=5) as response:
            data = json.load(response)
            sentry_tags['hubVersion'] = data['hubVersion']
            sentry_tags['coverVersion'] = data['coverVersion']
            return sentry_tags

    except Exception as error:
        print('Failed to load Sentry tags!')
        print(error)
        return sentry_tags


def _is_sentry_enabled():
    try:
        print('Checking if sentry is enabled...')
        services_url = "http://127.0.0.1:3000/api/services"

        with urllib.request.urlopen(services_url, timeout=5) as response:
            data = json.load(response)
            return data["sentryLogging"]["enabled"]
    except Exception as error:
        print('Failed to check if Sentry is enabled, enabling Sentry!')
        print(error)
        return True




def _init_sentry():
    if _is_sentry_enabled():

        sentry_sdk.init(
            dsn="https://71dec16dc7338369a770c424783d1712@o4510246020710401.ingest.us.sentry.io/4510252550979584",
            # Add data like request headers and IP for users,
            # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
            send_default_pii=False,
        )
        sentry_tags = _load_sentry_tags()
        sentry_sdk.set_tags(sentry_tags)



def get_logger(name: Optional[LoggerName] = None) -> BaseLogger:
    """
    Returns:
        BaseLogger: Custom logger with fixed-width formatting
    """
    logging.setLoggerClass(BaseLogger)
    logger, name = _get_logger_instance(name)
    if not logger.handlers:
        _build_logger(logger, name)
        _init_sentry()

    return logger

