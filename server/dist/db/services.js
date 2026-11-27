// LowDB, stores the schedules in /persistent/free-sleep-data/lowdb/schedulesDB.json
import _ from 'lodash';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import config from '../config.js';
const defaultData = {
    sentryLogging: {
        enabled: false,
    },
    biometrics: {
        enabled: false,
        jobs: {
            installation: {
                name: 'Biometrics installation',
                message: '',
                status: 'not_started',
                description: 'Whether or not biometrics was installed successfully',
                timestamp: '',
            },
            stream: {
                name: 'Biometrics stream',
                message: '',
                status: 'not_started',
                description: 'Consumes the sensor data as a stream and calculates biometrics',
                timestamp: '',
            },
            analyzeSleepLeft: {
                name: 'Analyze sleep - left',
                message: '',
                status: 'not_started',
                description: 'Analyzes sleep period',
                timestamp: '',
            },
            analyzeSleepRight: {
                name: 'Analyze sleep - right',
                message: '',
                status: 'not_started',
                description: 'Analyzes sleep period',
                timestamp: '',
            },
            calibrateLeft: {
                name: 'Calibration job - Left',
                message: '',
                status: 'not_started',
                description: 'Calculates presence thresholds for cap sensor data',
                timestamp: '',
            },
            calibrateRight: {
                name: 'Calibration job - Right',
                message: '',
                status: 'not_started',
                description: 'Calculates presence thresholds for cap sensor data',
                timestamp: '',
            }
        }
    }
};
const file = new JSONFile(`${config.lowDbFolder}servicesDB.json`);
const servicesDB = new Low(file, defaultData);
await servicesDB.read();
// Allows us to add default values to the services if users have existing servicesDB.json data
servicesDB.data = _.merge({}, defaultData, servicesDB.data);
await servicesDB.write();
export default servicesDB;
//# sourceMappingURL=services.js.map