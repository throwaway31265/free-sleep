import _ from 'lodash';
import { getFranken } from './frankenServer.js';
import logger from '../logger.js';
import cbor from 'cbor';


export const frankenCommands = {
  HELLO: '0',
  SET_TEMP: '1',
  SET_ALARM: '2',
  // RESET: '3',
  // FORCE_RESET: '4',
  ALARM_LEFT: '5',
  ALARM_RIGHT: '6',
  // FORMAT: '7',
  SET_SETTINGS: '8',
  LEFT_TEMP_DURATION: '9',
  RIGHT_TEMP_DURATION: '10',
  TEMP_LEVEL_LEFT: '11',
  TEMP_LEVEL_RIGHT: '12',
  PRIME: '13',
  DEVICE_STATUS: '14',
  ALARM_CLEAR: '16',
  ALARM_SOLO: "17",
  // STOP_PRIME: "18",
  VIBRATE: "-",
} as const;


export const invertedFrankenCommands = _.invert(frankenCommands);
// eslint-disable-next-line @typescript-eslint/no-type-alias
export type FrankenCommand = keyof typeof frankenCommands;
export type FrankenFunctions = Exclude<FrankenCommand, "PLEASE_SEND_VARIABLES">;

type Side = "left" | "right" | "solo";
function isSide(arg: string): arg is Side {
    return arg === "left" || arg === "right" || arg === "solo";
}

function getVibrationArgument() {
  const testDriveSettings = {
      pl: 100,
      du: 60,
      tt: Math.floor(new Date().getTime() / 1000) - 10,
      pi: "testdrive",
  };
  const cborEncoded = cbor.encode(testDriveSettings);
  const hexString = cborEncoded.toString("hex");
  return hexString;
}

function sideToFunction(side: Side): FrankenFunctions {
  switch (side) {
      case "left":
          return "ALARM_LEFT";
      case "right":
          return "ALARM_RIGHT";
      case "solo":
          return "ALARM_SOLO";
  }
}



export async function executeFunction(command: FrankenCommand, arg = 'empty'): Promise<void> {
  logger.debug(`Executing command | command: ${command} | arg: ${arg}`);

  const franken = await getFranken();
  // const frankenCommand = funcNameToFrankenCommand[name];
  // if franken disconnects right before a function call this will throw
  // the error will bubble up to the main loop of the device-api-client (protocol handling)
  // and the client will crash disconnecting from device-api - this is safe, it's correctly cleaned-up,
  // deviceApiLoop will take care of reconnecting to device-api

  if (command === 'VIBRATE') {
    if (!isSide(arg)) {
      logger.error(`invalid side argument ${arg}`);
      return;
  }

  // this.disableAlarm(30);

  // make frank vibrate
 // triggerVibration
 const vibrationArg = getVibrationArgument();
 const vibrationFunction = sideToFunction(arg);
 await franken.callFunction(vibrationFunction, vibrationArg);
 logger.debug(`Executing VIBRATE | vibrationArg: ${vibrationArg} | vibrationFunction: ${vibrationFunction}`);
} else {
  const response = await franken.callFunction(command, arg);
  logger.debug(response);
  return response;
}
}
