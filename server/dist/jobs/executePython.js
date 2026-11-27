import logger from '../logger.js';
import { exec } from 'child_process';
import fs from 'fs';
const { promises: fsPromises } = fs;
export const executePythonScript = async ({ script, args = [] }) => {
    const pythonExecutable = '/home/dac/venv/bin/python';
    try {
        await fsPromises.access(pythonExecutable, fs.constants.X_OK);
    }
    catch {
        logger.debug(`Not executing python script, ${pythonExecutable} does not exist!`);
        return;
    }
    const command = `${pythonExecutable} -B ${script} ${args.join(' ')}`;
    logger.info(`Executing: ${command}`);
    exec(command, { env: { ...process.env } }, (error, stdout, stderr) => {
        if (error) {
            logger.error(`Execution error: ${error.message}`);
            return;
        }
        if (stderr) {
            logger.error(`Python stderr: ${stderr}`);
        }
        if (stdout) {
            logger.info(`Python stdout: ${stdout}`);
        }
    });
};
//# sourceMappingURL=executePython.js.map