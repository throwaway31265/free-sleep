import cbor from 'cbor';
import _ from 'lodash';
import type { DeepPartial } from 'ts-essentials';
import { executeFunction } from '../../8sleep/deviceApi.js';
import { INVERTED_SETTINGS_KEY_MAPPING } from '../../8sleep/loadDeviceStatus.js';
import memoryDB from '../../db/memoryDB.js';
import settingsDB from '../../db/settings.js';
import logger from '../../logger.js';
import type { DeviceStatus, SideStatus } from './deviceStatusSchema.js';

const calculateLevelFromF = (temperatureF: number) => {
  const level = ((temperatureF - 82.5) / 27.5) * 100;
  return Math.round(level).toString();
};

const updateSide = async (
  side: 'left' | 'right',
  sideStatus: DeepPartial<SideStatus>,
) => {
  await settingsDB.read();
  const settings = settingsDB.data;
  const isAway = side === 'left' ? settings.left.awayMode : settings.right.awayMode;
  // If the side is in away mode, only allow safe operations that ensure it's off
  // or clearing alarms. Block any attempt to turn on or change temperatures.
  if (isAway) {
    const { isOn, targetTemperatureF, secondsRemaining, isAlarmVibrating } =
      sideStatus;
    // Don't block if explicitly turning off (isOn: false) - that's a safe operation
    if (isOn !== false) {
      const attemptingUnsafeChange =
        isOn !== undefined ||
        targetTemperatureF !== undefined ||
        secondsRemaining !== undefined;
      if (attemptingUnsafeChange) {
        throw new Error(
          `${side.charAt(0).toUpperCase() + side.slice(1)} side is in away mode, not updating side`,
        );
      }
    }
    // Allow turning off and clearing alarms below
  }
  // Only update the requested side. Do not mirror updates when the
  // other side is in away mode; away mode means that side is "off".
  const updateLeft = side === 'left';
  const updateRight = side === 'right';

  const { isOn, targetTemperatureF, secondsRemaining, isAlarmVibrating } =
    sideStatus;

  if (isOn !== undefined) {
    const onDuration = isOn ? '43200' : '0';
    if (updateLeft) await executeFunction('LEFT_TEMP_DURATION', onDuration);
    if (updateRight) await executeFunction('RIGHT_TEMP_DURATION', onDuration);
  }

  if (targetTemperatureF) {
    const level = calculateLevelFromF(targetTemperatureF);
    if (updateLeft) await executeFunction('TEMP_LEVEL_LEFT', level);
    if (updateRight) await executeFunction('TEMP_LEVEL_RIGHT', level);
  }

  if (secondsRemaining) {
    const seconds = Math.round(secondsRemaining).toString();
    if (updateLeft) await executeFunction('LEFT_TEMP_DURATION', seconds);
    if (updateRight) await executeFunction('RIGHT_TEMP_DURATION', seconds);
  }

  if (isAlarmVibrating !== undefined) {
    logger.debug('Can only set isAlarmVibrating to false for now...');
    if (!isAlarmVibrating) await executeFunction('ALARM_CLEAR', 'empty');
    await memoryDB.read();
    memoryDB.data[side].isAlarmVibrating = false;
    await memoryDB.write();
  }
};

const updateSettings = async (settings: Partial<DeviceStatus['settings']>) => {
  const renamedSettings = _.mapKeys(
    settings,
    (value, key) => INVERTED_SETTINGS_KEY_MAPPING[key] || key,
  );
  const encodedBuffer = cbor.encode(renamedSettings);
  const hexString = encodedBuffer.toString('hex');
  await executeFunction('SET_SETTINGS', hexString);
};

export const updateDeviceStatus = async (
  deviceStatus: DeepPartial<DeviceStatus>,
) => {
  logger.info(`Updating deviceStatus...`);

  try {
    if (deviceStatus.isPriming) await executeFunction('PRIME');
    if (deviceStatus?.left) await updateSide('left', deviceStatus.left);
    if (deviceStatus?.right) await updateSide('right', deviceStatus.right);
    if (deviceStatus?.settings) await updateSettings(deviceStatus.settings);
    logger.info('Finished updating device status');
  } catch (error) {
    logger.error('Error updating device status:', error);
    throw error;
  }
};
