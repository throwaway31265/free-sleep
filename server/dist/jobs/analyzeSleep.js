
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="3d051663-6a59-5173-adda-af8d7503107c")}catch(e){}}();
import { executePythonScript } from './executePython.js';
export const executeAnalyzeSleep = (side, startTime, endTime) => {
    executePythonScript({
        script: '/home/dac/free-sleep/biometrics/sleep_detection/analyze_sleep.py',
        args: [
            `--side=${side}`,
            `--start_time=${startTime}`,
            `--end_time=${endTime}`
        ]
    });
};
//# sourceMappingURL=analyzeSleep.js.map
//# debugId=3d051663-6a59-5173-adda-af8d7503107c
