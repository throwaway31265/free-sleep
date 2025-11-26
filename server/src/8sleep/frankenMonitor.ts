import { EventEmitter } from 'events';
import moment from 'moment-timezone';
import logger from '../logger.js';
import settingsDB from '../db/settings.js';
import { connectFranken } from './frankenServer.js';
import { wait } from './promises.js';
import { DeviceStatus, Version } from '../routes/deviceStatus/deviceStatusSchema.js';
import { Side } from '../db/schedulesSchema.js';
import { Gesture, GestureSchema } from '../db/settingsSchema.js';
import { updateDeviceStatus } from '../routes/deviceStatus/updateDeviceStatus.js';
import { DeepPartial } from 'ts-essentials';
import serverStatus from '../serverStatus.js';



export class FrankenMonitor extends EventEmitter {
  private isRunning: boolean;
  private deviceStatus?: DeviceStatus;

  constructor() {
    super();
    this.isRunning = false;
    this.deviceStatus = undefined;
  }

  public getDeviceStatus(): DeviceStatus | undefined {
    return this.deviceStatus;
  }

  public async start() {
    if (this.isRunning) {
      logger.warn('FrankenMonitor is already running');
      return;
    }
    this.isRunning = true;
    this.frankenLoop().catch(error => {
      logger.error(error);
      serverStatus.status.frankenMonitor.status = 'failed';
      serverStatus.status.frankenMonitor.message = String(error);
      serverStatus.status.frankenMonitor.timestamp = moment.tz().format();
    });
  }

  public stop() {
    if (!this.isRunning) return;
    logger.debug('Stopping FrankenMonitor loop');
    this.isRunning = false;
  }

  private async processGesture(side: Side, gesture: Gesture) {
    const behavior = settingsDB.data[side].taps[gesture];
    if (behavior.type === 'temperature') {
      const currentTemperatureTarget = this.deviceStatus![side].targetTemperatureF;
      let newTemperatureTargetF;
      const change = behavior.amount;
      if (behavior.change === 'increment') {
        newTemperatureTargetF = currentTemperatureTarget + change;
      } else {
        newTemperatureTargetF = currentTemperatureTarget + (-1 * change);
      }
      logger.debug(`Processing gesture temperature change for ${side}. ${currentTemperatureTarget} -> ${newTemperatureTargetF}`);
      return await updateDeviceStatus({ [side]: { targetTemperatureF: newTemperatureTargetF } } as DeepPartial<DeviceStatus>);
    } else if (behavior.type) {
      // TODO: Add alarm handling
      logger.warn('Skipping gesture...');
    }
  }

  private processGesturesForSide(nextDeviceStatus: DeviceStatus, side: Side) {
    try {
      for (const gesture of GestureSchema.options) {
        if (nextDeviceStatus[side].taps?.[gesture] !== this?.deviceStatus?.[side].taps?.[gesture]) {
          this.processGesture(side, gesture);
        }
      }
    } catch (error) {
      logger.error(error);
    }
  }

  private async processGestures(nextDeviceStatus: DeviceStatus) {
    if (!this.deviceStatus) {
      logger.warn('Missing current deviceStatus, exiting...');
      return;
    }

    this.processGesturesForSide(nextDeviceStatus, 'left');
    this.processGesturesForSide(nextDeviceStatus, 'right');
  }


  private async frankenLoop() {
    const franken = await connectFranken();
    this.deviceStatus = await franken.getDeviceStatus(false);
    let hasGestures = this.deviceStatus.coverVersion !== Version.Pod3;
    let waitTime = hasGestures ? 2_000 : 60_000;
    if (hasGestures) {
      this.deviceStatus = await franken.getDeviceStatus(true);
      logger.debug(`Gestures supported for ${this.deviceStatus.coverVersion}`);
    } else {
      logger.debug(`Gestures not supported for ${this.deviceStatus.coverVersion}`);
    }
    // Emit initial status
    this.emit('deviceStatus', this.deviceStatus);
    // No point in querying device status every 3 seconds for checking the prime status...
    while (this.isRunning) {
      try {
        while (this.isRunning) {
          hasGestures = this.deviceStatus.coverVersion !== Version.Pod3;
          waitTime = hasGestures ? 2_000 : 60_000;
          await wait(waitTime);
          if (!this.isRunning) break;
          const franken = await connectFranken();
          const nextDeviceStatus = await franken.getDeviceStatus(hasGestures);
          await settingsDB.read();
          if (hasGestures) {
            this.processGestures(nextDeviceStatus);
          }
          this.deviceStatus = nextDeviceStatus;
          this.emit('deviceStatus', nextDeviceStatus);
          serverStatus.status.frankenMonitor.status = 'healthy';
          serverStatus.status.frankenMonitor.message = '';
          serverStatus.status.frankenMonitor.timestamp = moment.tz().format();
        }
      } catch (error) {
        serverStatus.status.frankenMonitor.status = 'failed';
        serverStatus.status.frankenMonitor.message = String(error);
        serverStatus.status.frankenMonitor.timestamp = moment.tz().format();
        logger.error(error instanceof Error ? error.message : String(error), 'franken disconnected');
        await wait(waitTime);
      }
    }
    logger.debug('FrankenMonitor loop exited');
  }
}

// Singleton instance
export const frankenMonitor = new FrankenMonitor();

