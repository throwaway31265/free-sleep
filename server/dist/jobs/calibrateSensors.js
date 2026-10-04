
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="7b0fe748-2823-5243-997c-394f60f205ce")}catch(e){}}();
import { executePythonScript } from './executePython.js';
export const executeCalibrateSensors = (side, startTime, endTime) => {
    executePythonScript({
        script: '/home/dac/free-sleep/biometrics/sleep_detection/calibrate_sensor_thresholds.py',
        args: [
            `--side=${side}`,
            `--start_time=${startTime}`,
            `--end_time=${endTime}`
        ]
    });
};
//# sourceMappingURL=calibrateSensors.js.map
//# debugId=7b0fe748-2823-5243-997c-394f60f205ce
