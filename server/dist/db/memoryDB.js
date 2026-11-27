// This is for storing data in memory when we don't want to update any files in the config.dbFolder
// Updating files in the config.dbFolder will re-trigger job deletion and creation
// Tracks if the alarm is running (we can't get that programmatically from the pod) and autopilot runtime state
import { Low, Memory } from 'lowdb';
import { createDefaultRuntime } from '../autopilot/types.js';
const defaultMemoryDB = {
    left: {
        isAlarmVibrating: false,
        analyzeSleep: {
            lastRan: undefined,
        },
        autopilot: createDefaultRuntime(),
    },
    right: {
        isAlarmVibrating: false,
        analyzeSleep: {
            lastRan: undefined,
        },
        autopilot: createDefaultRuntime(),
    },
};
const adapter = new Memory();
const memoryDB = new Low(adapter, defaultMemoryDB);
await memoryDB.read();
memoryDB.data = memoryDB.data || defaultMemoryDB;
await memoryDB.write();
export default memoryDB;
//# sourceMappingURL=memoryDB.js.map