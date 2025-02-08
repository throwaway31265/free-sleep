import { Side } from '../db/schedulesSchema.js';
import { executePythonScript } from './executePython.js';

export const executeAnalyzeSleep = (side: Side, startTime: string, endTime: string): void => {
  executePythonScript({
    script: '/home/dac/free-sleep/biometrics/sleep_detection/analyze_sleep.py',
    args: [
      `--side=${side}`,
      `--start_time=${startTime}`,
      `--end_time=${endTime}`
    ]
  });
};
