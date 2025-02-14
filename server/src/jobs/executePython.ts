import logger from '../logger.js';
import { exec } from 'child_process';
import fs from 'fs';


type ExecutePythonScriptArgs = {
  script: string;
  args?: string[];
};

export const executePythonScript = ({ script, args = [] }: ExecutePythonScriptArgs): Promise<void> => {
  return new Promise((resolve, reject) => {
    const pythonExecutable = '/home/dac/venv/bin/python';
    if (!fs.existsSync(pythonExecutable)) {
      logger.debug(`Not executing python script, ${pythonExecutable} does not exist!`);
      reject(new Error(`Python executable not found: ${pythonExecutable}`));
      return;
    }
    const command = `${pythonExecutable} -B ${script} ${args.join(' ')}`;
    logger.info(`Executing: ${command}`);

    exec(command, { env: { ...process.env } }, (error, stdout, stderr) => {
      if (error) {
        logger.error(`Execution error: ${error.message}`);
        reject(error);
      }
      if (stderr) {
        logger.error(`Python stderr: ${stderr}`);
        reject(`Python stderr: ${stderr}`);
      }
      if (stdout) {
        logger.info(`Python stdout: ${stdout}`);
      }
      resolve();
    });
  });
};
