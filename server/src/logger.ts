import moment from 'moment-timezone';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    // Custom timestamp formatting
    winston.format.timestamp({
      format: () => {
        const date = new Date();
        return moment.utc(date).format('YYYY-MM-DD HH:mm:ss [UTC]');
      },
    }),
    // Custom log formatter
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} | ${level.padStart(8)} | ${message}`;
    }),
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `${timestamp} | ${level.padStart(15)} | ${message}`;
        }),
      ),
    }),
    new winston.transports.File({
      filename: '/persistent/free-sleep-data/logs/free-sleep.log',
      maxsize: 7 * 1024 * 1024,
      maxFiles: 1,
      tailable: true,
    }),
  ],
});

export default logger;
