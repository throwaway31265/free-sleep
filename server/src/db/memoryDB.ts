// This is for storing data in memory when we don't want to update any files in the config.dbFolder
// Updating files in the config.dbFolder will re-trigger job deletion and creation
// This only keeps track of if the alarm is running, since we can't get that programmatically from the pod
import { Low, Memory } from 'lowdb';

type SideState = {
  isAlarmVibrating: boolean;
};

type BaseStatus = {
  head: number;
  feet: number;
  isMoving: boolean;
  lastUpdate: string;
  isConfigured: boolean;
};

type MemoryDB = {
  left: SideState;
  right: SideState;
  baseStatus?: BaseStatus;
};

const defaultMemoryDB: MemoryDB = {
  left: {
    isAlarmVibrating: false,
  },
  right: {
    isAlarmVibrating: false,
  },
  baseStatus: undefined,
};

const adapter = new Memory<MemoryDB>();
const memoryDB = new Low<MemoryDB>(adapter, defaultMemoryDB);

await memoryDB.read();
memoryDB.data = memoryDB.data || defaultMemoryDB;
await memoryDB.write();

export default memoryDB;
