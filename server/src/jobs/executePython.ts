import { exec } from 'child_process';
import fs from 'fs';
import logger from '../logger.js';

type ExecutePythonScriptArgs = {
  script: string;
  args?: string[];
};

export const executePythonScript = ({
  script,
  args = [],
}: ExecutePythonScriptArgs): Promise<void> => {
  return new Promise((resolve, reject) => {
    const pythonExecutable = '/home/dac/venv/bin/python';
    if (!fs.existsSync(pythonExecutable)) {
      logger.debug(
        `Not executing python script, ${pythonExecutable} does not exist!`,
      );
      reject(new Error(`Python executable not found: ${pythonExecutable}`));
      return;
    }
    // Run Python scripts as dac user to ensure proper file permissions
    const command = `sudo -u dac ${pythonExecutable} -B ${script} ${args.join(' ')}`;
    logger.info(`Executing: ${command}`);

    exec(command, {
      env: { ...process.env },
      cwd: '/home/dac/free-sleep/biometrics'
    }, (error, stdout, stderr) => {
      if (error) {
        logger.error(`Execution error: ${error.message}`);
        reject(error);
        return;
      }
      if (stderr) {
        logger.error(`Python stderr: ${stderr}`);
        reject(new Error(`Python stderr: ${stderr}`));
        return;
      }
      if (stdout) {
        logger.info(`Python stdout: ${stdout}`);
      }
      resolve();
    });
  });
};
