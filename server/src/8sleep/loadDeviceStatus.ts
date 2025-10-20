import cbor from 'cbor';
import _ from 'lodash';
import { z } from 'zod';
import memoryDB from '../db/memoryDB.js';
import logger from '../logger.js';
import type { DeviceStatus } from '../routes/deviceStatus/deviceStatusSchema.js';
import { getFrankenMonitor } from '../server.js';

const RawDeviceData = z.object({
  tgHeatLevelR: z.string().regex(/^-?\d+$/, {
    message: 'tgHeatLevelR must be a numeric value in a string',
  }),
  tgHeatLevelL: z.string().regex(/^-?\d+$/, {
    message: 'tgHeatLevelL must be a numeric value in a string',
  }),
  heatTimeL: z.string().regex(/^\d+$/, {
    message: 'heatTimeL must be a positive numeric value in a string',
  }),
  heatLevelL: z.string().regex(/^-?\d+$/, {
    message: 'heatLevelL must be a numeric value in a string',
  }),
  heatTimeR: z.string().regex(/^\d+$/, {
    message: 'heatTimeR must be a positive numeric value in a string',
  }),
  heatLevelR: z.string().regex(/^-?\d+$/, {
    message: 'heatLevelR must be a numeric value in a string',
  }),
  sensorLabel: z.string(),
  waterLevel: z.string().regex(/^(true|false)$/, {
    message: 'waterLevel must be "true" or "false"',
  }),
  priming: z
    .string()
    .regex(/^(true|false)$/, { message: 'priming must be "true" or "false"' }),
  settings: z.string(),
  // Optional raw water level data - these might not always be present
  capwaterRaw: z.string().regex(/^-?\d+(\.\d+)?$/, {
    message: 'capwaterRaw must be a numeric value in a string',
  }).optional(),
  capwaterEmpty: z.string().regex(/^-?\d+(\.\d+)?$/, {
    message: 'capwaterEmpty must be a numeric value in a string',
  }).optional(),
  capwaterFull: z.string().regex(/^-?\d+(\.\d+)?$/, {
    message: 'capwaterFull must be a numeric value in a string',
  }).optional(),
});

type RawDeviceDataType = z.infer<typeof RawDeviceData>;

// Reads & validates the raw response data from socket and converts it to an object
const parseRawDeviceData = (response: string): RawDeviceDataType => {
  const rawDeviceData = Object.fromEntries(
    response.split('\n').map((l) => l.split(' = ')),
  );

  try {
    RawDeviceData.parse(rawDeviceData);
    return rawDeviceData;
  } catch (error) {
    logger.error(error);
    throw error;
  }
};

// Scale goes from -100 < - > 100
// Low  -> 55
// High -> 110
// 0 -> 82.5f
// -100 -> 55f
// 100 -> 110f
const calculateTempInF = (value: string): number => {
  const level = Number(value);
  if (level === 0) {
    // Technically 0 is 82.5, rounding the temperature simplifies everything though...
    return 83;
  } else if (level < 0) {
    return Math.round(82.5 - ((-1 * level) / 100) * 27.5);
  } else {
    return Math.round(82.5 + (level / 100) * 27.5);
  }
};

export const SETTINGS_KEY_MAPPING = {
  gl: 'gainLeft',
  gr: 'gainRight',
  lb: 'ledBrightness',
};

export const INVERTED_SETTINGS_KEY_MAPPING = _.invert(SETTINGS_KEY_MAPPING);
// Raw settings string is a CBOR encoded string
const decodeSettings = (rawSettings: string): DeviceStatus['settings'] => {
  // Convert hex string to a buffer
  const cborBuffer = Buffer.from(rawSettings.replace(/"/g, ''), 'hex');
  const decoded = cbor.decode(cborBuffer);
  // @ts-ignore
  const renamedDecoded = _.mapKeys(
    decoded,
    (_value, key) =>
      SETTINGS_KEY_MAPPING[key as keyof typeof SETTINGS_KEY_MAPPING] || key,
  );
  return renamedDecoded as DeviceStatus['settings'];
};

// The default naming convention was ugly... This remaps the keys to human-readable names
export async function loadDeviceStatus(
  response: string,
): Promise<DeviceStatus> {
  const rawDeviceData = parseRawDeviceData(response);
  const leftSideSecondsRemaining = Number(rawDeviceData.heatTimeL);
  const rightSideSecondsRemaining = Number(rawDeviceData.heatTimeR);
  await memoryDB.read();

  // Extract raw water level data if available
  const waterLevelRaw = rawDeviceData.capwaterRaw || rawDeviceData.capwaterEmpty || rawDeviceData.capwaterFull
    ? {
        raw: rawDeviceData.capwaterRaw ? Number.parseFloat(rawDeviceData.capwaterRaw) : undefined,
        calibratedEmpty: rawDeviceData.capwaterEmpty ? Number.parseFloat(rawDeviceData.capwaterEmpty) : undefined,
        calibratedFull: rawDeviceData.capwaterFull ? Number.parseFloat(rawDeviceData.capwaterFull) : undefined,
        timestamp: Math.floor(Date.now() / 1000),
      }
    : undefined;

  // Get room climate data from FrankenMonitor
  const frankenMonitor = getFrankenMonitor();
  const roomClimate = frankenMonitor?.getRoomClimateData();

  return {
    left: {
      currentTemperatureF: calculateTempInF(rawDeviceData.heatLevelL),
      targetTemperatureF: calculateTempInF(rawDeviceData.tgHeatLevelL),
      secondsRemaining: leftSideSecondsRemaining,
      isOn: leftSideSecondsRemaining > 0,
      isAlarmVibrating: memoryDB.data.left.isAlarmVibrating,
    },
    right: {
      currentTemperatureF: calculateTempInF(rawDeviceData.heatLevelR),
      targetTemperatureF: calculateTempInF(rawDeviceData.tgHeatLevelR),
      secondsRemaining: rightSideSecondsRemaining,
      isOn: rightSideSecondsRemaining > 0,
      isAlarmVibrating: memoryDB.data.right.isAlarmVibrating,
    },
    waterLevel: rawDeviceData.waterLevel,
    isPriming: rawDeviceData.priming === 'true',
    waterLevelRaw,
    roomClimate: roomClimate ? {
      temperatureC: roomClimate.temperatureC,
      humidity: roomClimate.humidity,
      timestamp: roomClimate.timestamp,
    } : undefined,
    settings: decodeSettings(rawDeviceData.settings),
  };
}
