from typing import Literal, get_args, Optional, Tuple, List
import platform
import traceback
import logging
from logging.handlers import RotatingFileHandler
import sys
from datetime import datetime
import os

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

    log_file_path = f"{folder_path}/{name}.log"

    # Ensure proper ownership on Linux systems before creating the handler
    if platform.system().lower() == 'linux':
        try:
            import pwd
            import grp
            # Get dac user and group IDs
            dac_user = pwd.getpwnam('dac')
            dac_group = grp.getgrnam('dac')

            # Ensure logs directory has correct ownership
            if os.path.exists(folder_path):
                dir_stat = os.stat(folder_path)
                if dir_stat.st_uid != dac_user.pw_uid or dir_stat.st_gid != dac_group.gr_gid:
                    os.chown(folder_path, dac_user.pw_uid, dac_group.gr_gid)

            # If log file exists, ensure it has correct ownership
            if os.path.exists(log_file_path):
                file_stat = os.stat(log_file_path)
                if file_stat.st_uid != dac_user.pw_uid or file_stat.st_gid != dac_group.gr_gid:
                    os.chown(log_file_path, dac_user.pw_uid, dac_group.gr_gid)
        except (PermissionError, KeyError, OSError):
            # If we can't change ownership (e.g., not running as root/sudo), just continue
            # The file will be created with current user's permissions
            pass

    handler = RotatingFileHandler(
        filename=log_file_path,
        mode='a',
        maxBytes=10 * 1024 * 1024,  # 10MB max file size
        backupCount=0,  # No rotation, just truncate when max size is reached
        encoding="utf-8",
    )
    handler.setFormatter(FORMATTER)

    # Final check: ensure the newly created log file has correct ownership
    if platform.system().lower() == 'linux':
        try:
            import pwd
            import grp
            dac_user = pwd.getpwnam('dac')
            dac_group = grp.getgrnam('dac')
            if os.path.exists(log_file_path):
                file_stat = os.stat(log_file_path)
                if file_stat.st_uid != dac_user.pw_uid or file_stat.st_gid != dac_group.gr_gid:
                    os.chown(log_file_path, dac_user.pw_uid, dac_group.gr_gid)
        except (PermissionError, KeyError, OSError):
            pass

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

    if platform.system().lower() == 'linux':
        logger.env = 'prod'
        logger.folder_path = '/persistent/free-sleep-data/'
    else:
        logger.env = 'local'
        logger.folder_path = '/Users/ds/free-sleep/server/free-sleep-data/'

    logger.setLevel(logging.DEBUG)
    logger.addHandler(_get_console_handler())
    logger.addHandler(_get_file_handler(logger.folder_path, name))


def get_logger(name: Optional[LoggerName] = None) -> BaseLogger:
    """
    Returns:
        BaseLogger: Custom logger with fixed-width formatting
    """
    logging.setLoggerClass(BaseLogger)
    logger, name = _get_logger_instance(name)
    if not logger.handlers:
        _build_logger(logger, name)
    return logger
