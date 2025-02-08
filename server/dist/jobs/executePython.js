import logger from '../logger.js';
import { spawn } from 'child_process';
export const logOutput = (data) => {
    const output = data.toString().trim();
    const logLines = output.split('\n');
    logLines.forEach(line => {
        const cleanedLine = line.split(' UTC | ')?.[1] || line;
        if (/\\bERROR\\b/.test(cleanedLine)) {
            logger.error(cleanedLine);
        }
        else if (/\\bDEBUG\\b/.test(cleanedLine)) {
            logger.debug(cleanedLine);
        }
        else if (/\\bINFO\\b/.test(cleanedLine)) {
            logger.info(cleanedLine);
        }
        else {
            logger.info(cleanedLine);
        }
    });
};
export const executePythonScript = ({ script, cwd = '/home/dac/bio/src/presence_detection/', args = [] }) => {
    logger.info(`Executing ${script} ${args}`);
    const process = spawn('/usr/bin/python3', [
        script,
        ...args,
    ], {
        cwd,
    });
    process.stdout.on('data', logOutput);
    process.stderr.on('data', logOutput);
    process.on('close', (code) => {
        logger.info(`Python script exited with code ${code}`);
    });
};
