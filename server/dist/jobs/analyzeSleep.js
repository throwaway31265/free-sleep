import { spawn } from 'child_process';
import logger from '../logger.js';
export const executeAnalyzeSleep = (side, startTime, endTime) => {
    logger.info(`Executing analyze_sleep ${side} ${startTime} | ${endTime}`);
    const pythonScript = '/home/dac/bio/src/presence_detection/analyze_sleep.py';
    const args = [
        pythonScript,
        `--side=${side}`,
        `--start_time=${startTime}`,
        `--end_time=${endTime}`
    ];
    const options = {
        cwd: '/home/dac/bio/src/presence_detection', // Ensure correct working directory
    };
    const process = spawn('/usr/bin/python3', args, options);
    const logOutput = (data) => {
        const output = data.toString().trim();
        const logLines = output.split('\n');
        logLines.forEach(line => {
            if (/\\bERROR\\b/.test(line)) {
                logger.error(line);
            }
            else if (/\\bDEBUG\\b/.test(line)) {
                logger.debug(line);
            }
            else if (/\\bINFO\\b/.test(line)) {
                logger.info(line);
            }
            else {
                logger.info(line); // Default to info if no level detected
            }
        });
    };
    process.stdout.on('data', logOutput);
    process.stderr.on('data', logOutput);
    process.on('close', (code) => {
        logger.info(`Python script exited with code ${code}`);
    });
};
