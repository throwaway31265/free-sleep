// LowDB, stores the schedules in /persistent/free-sleep-data/lowdb/settingsDB.json
import _ from 'lodash';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import config from '../config.js';
import type { Settings } from './settingsSchema.js';

const defaultData: Settings = {
  timeZone: null,
  temperatureFormat: 'fahrenheit',
  rebootDaily: true,
  left: {
    name: 'Left',
    awayMode: false,
  },
  right: {
    name: 'Right',
    awayMode: false,
  },
  lastPrime: undefined,
  primePodDaily: {
    enabled: false,
    time: '14:00',
  },
};

const file = new JSONFile<Settings>(`${config.lowDbFolder}settingsDB.json`);
const settingsDB = new Low<Settings>(file, defaultData);
await settingsDB.read();
// Allows us to add default values to the settings if users have existing settingsDB.json data
settingsDB.data = _.merge({}, defaultData, settingsDB.data);
await settingsDB.write();

export default settingsDB;
