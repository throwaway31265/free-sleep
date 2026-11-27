import { z } from 'zod';
import { Version } from '../routes/deviceStatus/deviceStatusSchema.js';
import logger from '../logger.js';
import memoryDB from '../db/memoryDB.js';
import cbor from 'cbor';
import { access, readFile } from 'fs/promises';
import { constants } from 'fs';
import _ from 'lodash';
import serverInfo from '../serverInfo.json' with { type: 'json' };
import { WIFI_SIGNAL_STRENGTH } from './wifiSignalStrength.js';
import { GestureSchema } from '../db/settingsSchema.js';
const RawDeviceData = z.object({
    tgHeatLevelR: z.string().regex(/^-?\d+$/, { message: 'tgHeatLevelR must be a numeric value in a string' }),
    tgHeatLevelL: z.string().regex(/^-?\d+$/, { message: 'tgHeatLevelL must be a numeric value in a string' }),
    heatTimeL: z.string().regex(/^\d+$/, { message: 'heatTimeL must be a positive numeric value in a string' }),
    heatLevelL: z.string().regex(/^-?\d+$/, { message: 'heatLevelL must be a numeric value in a string' }),
    heatTimeR: z.string().regex(/^\d+$/, { message: 'heatTimeR must be a positive numeric value in a string' }),
    heatLevelR: z.string().regex(/^-?\d+$/, { message: 'heatLevelR must be a numeric value in a string' }),
    sensorLabel: z.string(),
    waterLevel: z.string().regex(/^(true|false)$/, { message: 'waterLevel must be "true" or "false"' }),
    priming: z.string().regex(/^(true|false)$/, { message: 'priming must be "true" or "false"' }),
    settings: z.string(),
    doubleTap: z.string().optional(),
    tripleTap: z.string().optional(),
    quadTap: z.string().optional(),
});
// Reads & validates the raw response data from socket and converts it to an object
const parseRawDeviceData = (response) => {
    const rawDeviceData = Object.fromEntries(response.split('\n').map(l => l.split(' = ')));
    try {
        RawDeviceData.parse(rawDeviceData);
        return rawDeviceData;
    }
    catch (error) {
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
const calculateTempInF = (value) => {
    const level = Number(value);
    if (level === 0) {
        // Technically 0 is 82.5, rounding the temperature simplifies everything though...
        return 83;
    }
    else if (level < 0) {
        return Math.round(82.5 - (-1 * level / 100) * 27.5);
    }
    else {
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
const decodeSettings = (rawSettings) => {
    // Convert hex string to a buffer
    const cborBuffer = Buffer.from(rawSettings.replace(/"/g, ''), 'hex');
    const decoded = cbor.decode(cborBuffer);
    // @ts-ignore
    const renamedDecoded = _.mapKeys(decoded, (value, key) => SETTINGS_KEY_MAPPING[key] || key);
    return renamedDecoded;
};
const detectCoverVersion = (sensorLabel) => {
    try {
        if (!sensorLabel)
            return Version.NotFound;
        const hwRev = sensorLabel.split('-')[2];
        if (hwRev >= 'J00') {
            // Guessing Pod 5 here, based off Discord
            // https://discord.com/channels/1326539919467745361/1430959872408686775/1431033889924579419
            return Version.Pod5;
        }
        else if (hwRev >= 'I00') {
            return Version.Pod4;
        }
        else if (hwRev >= 'H00') {
            return Version.Pod3;
        }
        else {
            return Version.NotFound;
        }
    }
    catch (error) {
        logger.error(error);
        return Version.NotFound;
    }
};
const loadDeviceLabel = async () => {
    const pathVersions = [
        '/deviceinfo/device-label',
        '/persistent/deviceinfo/device-label',
    ];
    for (const path of pathVersions) {
        const exists = await access(path, constants.F_OK)
            .then(() => true)
            .catch(() => false);
        if (exists) {
            return readFile(path, 'utf-8');
        }
    }
    logger.info('Device label not found');
    return undefined;
};
const detectHubVersion = async () => {
    try {
        const label = await loadDeviceLabel();
        if (!label)
            return Version.NotFound;
        const hwRev = label.split('-')[2];
        if (hwRev >= 'G53') {
            // Guessing Pod 5 here, based off Discord
            // https://discord.com/channels/1326539919467745361/1430959872408686775/1431033889924579419
            return Version.Pod5;
        }
        else if (hwRev >= 'G00') {
            return Version.Pod4;
        }
        else {
            const pod3PathExists = await access('/deviceinfo/device-label', constants.F_OK)
                .then(() => true)
                .catch(() => false);
            if (pod3PathExists)
                return Version.Pod3;
        }
        return Version.NotFound;
    }
    catch (error) {
        logger.error(error);
        return Version.NotFound;
    }
};
const HUB_VERSION = await detectHubVersion();
// The default naming convention was ugly... This remaps the keys to human-readable names
export async function loadDeviceStatus(response, getGestures) {
    const rawDeviceData = parseRawDeviceData(response);
    const leftSideSecondsRemaining = Number(rawDeviceData.heatTimeL);
    const rightSideSecondsRemaining = Number(rawDeviceData.heatTimeR);
    await memoryDB.read();
    const deviceStatus = {
        left: {
            currentTemperatureLevel: Number.parseInt(rawDeviceData.heatLevelL, 10),
            currentTemperatureF: calculateTempInF(rawDeviceData.heatLevelL),
            targetTemperatureF: calculateTempInF(rawDeviceData.tgHeatLevelL),
            secondsRemaining: leftSideSecondsRemaining,
            isOn: leftSideSecondsRemaining > 0,
            isAlarmVibrating: memoryDB.data.left.isAlarmVibrating,
        },
        right: {
            currentTemperatureLevel: Number.parseInt(rawDeviceData.heatLevelR, 10),
            currentTemperatureF: calculateTempInF(rawDeviceData.heatLevelR),
            targetTemperatureF: calculateTempInF(rawDeviceData.tgHeatLevelR),
            secondsRemaining: rightSideSecondsRemaining,
            isOn: rightSideSecondsRemaining > 0,
            isAlarmVibrating: memoryDB.data.right.isAlarmVibrating,
        },
        coverVersion: detectCoverVersion(rawDeviceData.sensorLabel),
        hubVersion: HUB_VERSION,
        freeSleep: {
            version: serverInfo.version,
            branch: serverInfo.branch,
        },
        waterLevel: rawDeviceData.waterLevel,
        isPriming: rawDeviceData.priming === 'true',
        settings: decodeSettings(rawDeviceData.settings),
        wifiStrength: WIFI_SIGNAL_STRENGTH,
    };
    if (getGestures) {
        try {
            // @ts-expect-error - fields get populated below
            deviceStatus.left.taps = {};
            // @ts-expect-error - fields get populated below
            deviceStatus.right.taps = {};
            for (const field of GestureSchema.options) {
                const data = rawDeviceData[field];
                if (!data)
                    continue;
                const taps = JSON.parse(data);
                deviceStatus.left.taps[field] = taps.l;
                deviceStatus.right.taps[field] = taps.r;
            }
        }
        catch (error) {
            logger.error(error);
        }
    }
    return deviceStatus;
}
//# sourceMappingURL=loadDeviceStatus.js.map