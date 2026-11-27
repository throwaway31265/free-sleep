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