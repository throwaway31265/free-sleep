// LowDB, stores the schedules in /persistent/free-sleep-data/lowdb/settingsDB.json
import _ from 'lodash';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';

import { Settings, SideSettings } from './settingsSchema.js';
import config from '../config.js';

const defaultSideSettings: SideSettings = {
  name: 'Side',
  awayMode: false,
  scheduleOverrides: {
    temperatureSchedules: {
      disabled: false,
      expiresAt: ''
    },
    alarm: {
      disabled: false,
      timeOverride: '',
      expiresAt: '',
    }
  },
  taps: {
    doubleTap: {
      type: 'temperature',
      change: 'decrement',
      amount: 1,
    },
    tripleTap: {
      type: 'temperature',
      change: 'increment',
      amount: 1,
    },
    quadTap: {
      type: 'alarm',
      behavior: 'dismiss',
      snoozeDuration: 60,
      inactiveAlarmBehavior: 'power',
    },
  },
  autopilot: {
    enabled: false,
    mode: 'active',
    maxOffsetF: 3,
    stepF: 1,
    minMinutesBetweenChanges: 20,
    manualHoldMinutes: 180,
    absoluteMinF: 55,
    absoluteMaxF: 110,
    room: {
      enabled: true,
      referenceC: null,
      gainFPerC: 1.0,
      deadbandC: 0.5,
    },
    wakeWarmup: {
      enabled: false,
      minutes: 30,
      deltaF: 2,
    },
    vitals: {
      enabled: false,
      hrDropBpm: 6,
      deltaF: -1,
    },
  },
};

const defaultData: Settings = {
  id: crypto.randomUUID(),
  timeZone: 'UTC',
  temperatureFormat: 'fahrenheit',
  rebootDaily: true,
  left: {
    ..._.cloneDeep(defaultSideSettings),
    name: 'Left',
  },
  right: {
    ..._.cloneDeep(defaultSideSettings),
    name: 'Right',
  },
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
