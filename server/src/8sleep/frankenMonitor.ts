import cbor from 'cbor';
import fs from 'fs';
import memoryDB from '../db/memoryDB.js';
import settingsDB from '../db/settings.js';
import { storeWaterLevelReading, getRecentWaterLevelReadings } from '../db/waterLevelReadings.js';
import logger from '../logger.js';
import { BASE_PRESETS } from './basePresets.js';
import { executeFunction } from './deviceApi.js';
import { getFranken } from './frankenServer.js';
import { wait } from './promises.js';
import { trimixBase } from './trimixBaseControl.js';

const defaultAlarmDismiss: { [i: string]: number } = {};
const defaultDoubleTap: { [i: string]: number } = {};
const defaultTripleTap: { [i: string]: number } = {};
const defaultQuadTap: { [i: string]: number } = {};

const defaultVarValues: { [i: string]: string } = {
  sensorLabel: 'null',
  leftPillowLabel: 'null',
  rightPillowLabel: 'null',
  waterLevel: 'true',
  priming: 'false',
  updating: 'false',
  settings: 'null',

  heatLevelL: '10',
  heatLevelR: '10',
  tgHeatLevelL: '10',
  tgHeatLevelR: '10',
  heatTimeL: '0',
  heatTimeR: '0',
  dismissAlarm: JSON.stringify(defaultAlarmDismiss),
  doubleTap: JSON.stringify(defaultDoubleTap),
  tripleTap: JSON.stringify(defaultTripleTap),
  quadTap: JSON.stringify(defaultQuadTap),
  needsPrime: '0',
};

const DEFAULT_SNOOZE_MINUTES = 9;
const MIN_SNOOZE_MINUTES = 1;
const MAX_SNOOZE_MINUTES = 10;

export class FrankenMonitor {
  private variableValues = defaultVarValues;
  // private networkInfo = DeviceApiNetworkInfo.default;
  private alarmDismiss = defaultAlarmDismiss;
  private doubleTap = defaultDoubleTap;
  private tripleTap = defaultTripleTap;
  private quadTap = defaultQuadTap;

  private isRunning = false;
  private wasPriming = false;
  private currentBasePreset: keyof typeof BASE_PRESETS = 'relax';
  // Track last processed capwater log signature to avoid duplicate inserts
  private lastCapwaterSignature: string | null = null;
  // Store latest room climate data
  private roomClimateData: { temperatureC: number; humidity: number; timestamp: number } | null = null;

  public async start() {
    if (this.isRunning) {
      logger.warn('FrankenMonitor is already running');
      return;
    }

    logger.info('Starting FrankenMonitor');

    this.isRunning = true;

    // Backfill historical water readings from logs if database is empty
    await this.backfillHistoricalWaterReadings();

    // Start the monitoring loop
    this.frankenLoop().catch((err) => {
      logger.error(
        err instanceof Error ? err.message : String(err),
        'Error in FrankenMonitor loop',
      );
      this.isRunning = false;
    });
  }

  public stop() {
    this.isRunning = false;
  }

  // private dismissNotification: ((d: { [i: string]: number }) => Promise<void>) | undefined;

  public async dismissNotification(
    times: { [i: string]: number },
    snooze = false,
  ) {
    logger.info(
      `[dismissAlarm] times: ${JSON.stringify(times)} snooze: ${snooze}`,
    );
    if (snooze) {
      try {
        // Determine which side was most recently active
        const leftTime = times['l'] || 0;
        const rightTime = times['r'] || 0;
        const side = leftTime > rightTime ? 'left' : 'right';

        // Read existing alarm settings using CBOR decoding
        const alarmBytes = fs.readFileSync('/persistent/alarm.cbr');
        const alarmData = cbor.decode(alarmBytes);
        logger.debug(
          `Decoded alarm data: ${JSON.stringify(alarmData)}`,
          'alarm data',
        );

        // Access the side data
        const sideData = alarmData[side];
        if (!sideData || typeof sideData !== 'object') {
          throw new Error(`Invalid alarm data for ${side} side`);
        }

        // Validate snooze minutes
        if (
          DEFAULT_SNOOZE_MINUTES < MIN_SNOOZE_MINUTES ||
          DEFAULT_SNOOZE_MINUTES > MAX_SNOOZE_MINUTES
        ) {
          throw new Error('Snooze minutes must be between 1 and 10');
        }

        // Calculate snooze time
        const snoozeTime =
          Math.floor(Date.now() / 1000) + DEFAULT_SNOOZE_MINUTES * 60;

        // Create alarm payload using existing settings
        const alarmPayload = {
          pl: sideData.pl,
          du: sideData.du,
          tt: snoozeTime,
          pi: sideData.pi,
        };

        const cborPayload = cbor.encode(alarmPayload);
        const hexPayload = cborPayload.toString('hex');
        const command =
          side === 'left'
            ? 'ALARM_LEFT'
            : side === 'right'
              ? 'ALARM_RIGHT'
              : 'ALARM_SOLO';

        logger.info(
          `Setting snooze alarm for ${side} side in ${DEFAULT_SNOOZE_MINUTES} minutes with pattern ${alarmPayload.pi} (payload: ${JSON.stringify(alarmPayload)})`,
        );
        await executeFunction(command, hexPayload);
      } catch (error) {
        logger.error(
          `Failed to snooze alarm: ${error instanceof Error ? error.message : String(error)}`,
        );
        // On error, just clear the alarm
        await executeFunction('ALARM_CLEAR', 'empty');
      }
    } else {
      await executeFunction('ALARM_CLEAR', 'empty');
    }
  }

  private async tryNotifyDismiss(dismiss: { [i: string]: number }) {
    if (this.dismissNotification === undefined) return;
    // Read user preference for alarm button behavior
    await settingsDB.read();
    const shouldSnooze = settingsDB.data.alarmButtonBehavior === 'snooze';
    await this.dismissNotification(dismiss, shouldSnooze);
  }

  private async processAlarmDismiss() {
    await this.processGesture(
      'dismissAlarm',
      this.alarmDismiss,
      this.tryNotifyDismiss.bind(this),
    );
  }

  //private doubleTapNotification: ((d: { [i: string]: number }) => Promise<void>) | undefined;
  public async doubleTapNotification(times: { [i: string]: number }) {
    // Determine which side was tapped by checking which timestamp is newer
    const leftTime = times['l'] || 0;
    const rightTime = times['r'] || 0;

    // Get the side that was most recently tapped
    const tappedSide = leftTime > rightTime ? 'left' : 'right';
    const currentLevel = parseInt(
      tappedSide === 'left'
        ? this.variableValues.heatLevelL
        : this.variableValues.heatLevelR,
    );

    // Decrease by 10 (one level)
    const newLevel = Math.max(-100, currentLevel - 10).toString();

    logger.debug(
      `[doubleTap] times: ${JSON.stringify(times)} | side: ${tappedSide} | currentLevel: ${currentLevel} | newLevel: ${newLevel}`,
      'double tap',
    );

    // Only update the tapped side
    if (tappedSide === 'left') {
      await executeFunction('TEMP_LEVEL_LEFT', newLevel);
    } else {
      await executeFunction('TEMP_LEVEL_RIGHT', newLevel);
    }
  }
  private async tryNotifyDoubleTap(doubleTap: { [i: string]: number }) {
    if (this.doubleTapNotification === undefined) return;
    await this.doubleTapNotification(doubleTap);
  }

  // private tripleTapNotification: ((d: { [i: string]: number }) => Promise<void>) | undefined;
  public async tripleTapNotification(times: { [i: string]: number }) {
    // Determine which side was tapped by checking which timestamp is newer
    const leftTime = times['l'] ?? 0;
    const rightTime = times['r'] ?? 0;

    // Get the side that was most recently tapped
    const tappedSide = leftTime > rightTime ? 'left' : 'right';
    const currentLevel = parseInt(
      tappedSide === 'left'
        ? this.variableValues.heatLevelL
        : this.variableValues.heatLevelR,
    );

    // Increase by 10 (one level)
    const newLevel = Math.min(100, currentLevel + 10).toString();

    logger.debug(
      `[tripleTap] times: ${JSON.stringify(times)} | side: ${tappedSide} | currentLevel: ${currentLevel} | newLevel: ${newLevel}`,
      'triple tap',
    );

    // Only update the tapped side
    if (tappedSide === 'left') {
      await executeFunction('TEMP_LEVEL_LEFT', newLevel);
    } else {
      await executeFunction('TEMP_LEVEL_RIGHT', newLevel);
    }
  }
  private async tryNotifyTripleTap(tripleTap: { [i: string]: number }) {
    if (this.tripleTapNotification === undefined) return;
    await this.tripleTapNotification(tripleTap);
  }

  // private quadTapNotification: ((d: { [i: string]: number }) => Promise<void>) | undefined;
  public async quadTapNotification(times: { [i: string]: number }) {
    logger.debug(`[quadTap] times: ${JSON.stringify(times)}`, 'quad tap');

    // TODO: Trigger vibration feedback for quad tap
    try {
      logger.debug('[quadTap] Vibration feedback triggered');
    } catch (error) {
      logger.error(
        `[quadTap] Failed to trigger vibration: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Cycle between relax and flat presets
    this.currentBasePreset =
      this.currentBasePreset === 'relax' ? 'flat' : 'relax';

    const targetPreset = BASE_PRESETS[this.currentBasePreset];

    logger.info(
      `[quadTap] Cycling base to ${this.currentBasePreset} preset:`,
      targetPreset,
    );

    try {
      // Update memory DB to reflect movement
      if (memoryDB.data) {
        memoryDB.data.baseStatus = {
          head: targetPreset.head,
          feet: targetPreset.feet,
          isMoving: true,
          lastUpdate: new Date().toISOString(),
          isConfigured: true,
        };
        await memoryDB.write();
      }

      // Control the base via BLE
      if (this.currentBasePreset === 'flat') {
        await trimixBase.goToFlat();
      } else {
        await trimixBase.setPosition({
          head: targetPreset.head,
          feet: targetPreset.feet,
          feedRate: targetPreset.feedRate,
        });
      }

      // Estimate movement completion time
      const currentStatus = memoryDB.data?.baseStatus;
      const estimatedTime = Math.max(
        Math.abs((currentStatus?.head || 0) - targetPreset.head) * 200,
        Math.abs((currentStatus?.feet || 0) - targetPreset.feet) * 200,
        3000, // Minimum 3 seconds
      );

      setTimeout(async () => {
        logger.info(
          `[quadTap] Base ${this.currentBasePreset} preset movement completed`,
        );
        if (memoryDB.data?.baseStatus) {
          memoryDB.data.baseStatus.isMoving = false;
          await memoryDB.write();
        }
      }, estimatedTime);
    } catch (error) {
      logger.error(
        `[quadTap] Failed to set base preset: ${error instanceof Error ? error.message : String(error)}`,
      );

      // Reset movement status on error
      if (memoryDB.data?.baseStatus) {
        memoryDB.data.baseStatus.isMoving = false;
        await memoryDB.write();
      }

      // Revert preset state on error
      this.currentBasePreset =
        this.currentBasePreset === 'relax' ? 'flat' : 'relax';
    }
  }
  private async tryNotifyQuadTap(quadTap: { [i: string]: number }) {
    if (this.quadTapNotification === undefined) return;
    await this.quadTapNotification(quadTap);
  }

  private async processTTC() {
    await this.processGesture(
      'doubleTap',
      this.doubleTap,
      this.tryNotifyDoubleTap.bind(this),
    );
    await this.processGesture(
      'tripleTap',
      this.tripleTap,
      this.tryNotifyTripleTap.bind(this),
    );
    await this.processGesture(
      'quadTap',
      this.quadTap,
      this.tryNotifyQuadTap.bind(this),
    );
  }

  private async processGesture(
    variableName: string,
    currentState: { [i: string]: number },
    notifyUpdate: (diff: { [i: string]: number }) => Promise<void>,
  ) {
    if (Object.keys(currentState).length === 0) {
      Object.assign(
        currentState,
        JSON.parse(this.variableValues[variableName]),
      );
      return;
    }

    const current = currentState;
    const next = JSON.parse(this.variableValues[variableName]);
    if (next.l > current.l || next.r > current.r || next.s > current.s) {
      logger.debug(
        `[processGesture] next: ${JSON.stringify(next)}`,
        `${variableName} state change`,
      );

      const diff: { [i: string]: number } = {};
      Object.keys(next).forEach((key) => {
        if (next[key] > current[key]) diff[key] = next[key];
      });

      if (Object.keys(diff).length > 0) {
        await notifyUpdate(diff);
      }

      Object.assign(currentState, next);
    }
  }

  private async processPrimingState() {
    const isPriming = this.variableValues.priming === 'true';
    const needsPrime = parseInt(this.variableValues.needsPrime || '0', 10);

    // Pod 4 specific: needsPrime ranges from 0-5, where 0 = no priming needed
    const isPrimingRequired = needsPrime > 0;
    const isCurrentlyPriming = isPriming || isPrimingRequired;

    if (!isCurrentlyPriming && this.wasPriming) {
      this.wasPriming = false;
      settingsDB.data.lastPrime = new Date().toISOString();
      await settingsDB.write();
      logger.info(`[processPrimingState] Priming completed successfully (needsPrime: ${needsPrime})`);
    } else if (isCurrentlyPriming && !this.wasPriming) {
      this.wasPriming = true;
      logger.info(`[processPrimingState] Priming started (priming: ${isPriming}, needsPrime: ${needsPrime})`);
    }

    // Log priming status changes for debugging
    if (needsPrime > 0) {
      logger.debug(`[processPrimingState] Pod 4 needsPrime level: ${needsPrime}`);
    }
  }

  /**
   * Parse a capwater log line and extract sensor data
   */
  private parseCapwaterLogLine(logLine: string): { rawLevel: number; calibratedEmpty: number; calibratedFull: number; timestamp: number } | null {
    // Parse the log line: [frozen] -> FW: [capwater] Raw: 1.140402, Capwater calibrated. Empty: 0.84, Full: 1.13
    const regex = /\[capwater\] Raw:\s*([0-9.]+).*Empty:\s*([0-9.]+).*Full:\s*([0-9.]+)/;
    const match = logLine.match(regex);

    if (!match) {
      return null;
    }

    // Extract timestamp from the log line (Aug 20 23:25:55)
    const timestampRegex = /^(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})/;
    const timestampMatch = logLine.match(timestampRegex);

    let timestamp = Math.floor(Date.now() / 1000); // Default to now
    if (timestampMatch) {
      try {
        // Parse the syslog timestamp and convert to unix timestamp
        const currentYear = new Date().getFullYear();
        const logDate = new Date(`${timestampMatch[1]} ${currentYear}`);
        timestamp = Math.floor(logDate.getTime() / 1000);
      } catch {
        // If parsing fails, use current timestamp
      }
    }

    return {
      rawLevel: Number.parseFloat(match[1]),
      calibratedEmpty: Number.parseFloat(match[2]),
      calibratedFull: Number.parseFloat(match[3]),
      timestamp,
    };
  }

  /**
   * Parse a room climate (ambient temperature & humidity) line from frank logs
   * Example: "Oct 20 17:21:49 eight-pod frank[1201]: DBG:24251711 Sensor.cpp:658 handleCommand|[sensor] -> FW: 21130214 [ambient] temp 24.8352 humidity 41.2076 percent"
   */
  private parseRoomClimateLine(logLine: string): {
    temperatureC: number;
    humidity: number;
    timestamp: number
  } | null {
    // Parse: [ambient] temp 24.8352 humidity 41.2076 percent
    const regex = /\[ambient\] temp ([0-9.]+) humidity ([0-9.]+) percent/;
    const match = logLine.match(regex);

    if (!match) {
      return null;
    }

    // Extract timestamp from log line (format: "Oct 20 17:21:49")
    const timestampRegex = /^(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})/;
    const timestampMatch = logLine.match(timestampRegex);

    let timestamp = Math.floor(Date.now() / 1000);
    if (timestampMatch) {
      try {
        const currentYear = new Date().getFullYear();
        const logDate = new Date(`${timestampMatch[1]} ${currentYear}`);
        timestamp = Math.floor(logDate.getTime() / 1000);
      } catch {
        // Use current timestamp if parsing fails
      }
    }

    return {
      temperatureC: Number.parseFloat(match[1]),
      humidity: Number.parseFloat(match[2]),
      timestamp,
    };
  }

  /**
   * Backfill recent capwater readings from system logs on startup
   */
  private async backfillHistoricalWaterReadings(): Promise<void> {
    try {
      // Check if we already have recent readings (30 days = 720 hours)
      const existingReadings = await getRecentWaterLevelReadings(720);

      if (existingReadings.length > 0) {
        // Check the time span of existing data
        const oldestTimestamp = Math.min(...existingReadings.map(r => r.timestamp));
        const newestTimestamp = Math.max(...existingReadings.map(r => r.timestamp));
        const dataSpanHours = (newestTimestamp - oldestTimestamp) / 3600;
        const dataSpanDays = dataSpanHours / 24;

        if (dataSpanDays >= 5) {
          logger.info(`Found ${existingReadings.length} existing water readings spanning ${dataSpanDays.toFixed(1)} days, skipping backfill`);
          return;
        } else {
          logger.info(`Found ${existingReadings.length} existing water readings spanning only ${dataSpanDays.toFixed(1)} days (< 5 days), proceeding with backfill`);
        }
      } else {
        logger.info('No existing water readings found, backfilling from system logs...');
      }

      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      // Get all capwater readings from the last 30 days of logs (only frank process, not bun)
      // Only match lines that include the canonical capwater data pattern
      const { stdout } = await execAsync(
        'journalctl --no-pager --since "30 days ago" | grep "frank\\[" | grep -E "\\[capwater\\] Raw:"'
      );

      if (!stdout.trim()) {
        logger.info('No historical capwater readings found in system logs');
        return;
      }

      const logLines = stdout.trim().split('\n');
      let backfilledCount = 0;

      for (const logLine of logLines) {
        const parsed = this.parseCapwaterLogLine(logLine);
        if (!parsed) continue;

        // Assume not priming for historical data (we can't determine this from logs alone)
        await storeWaterLevelReading({
          timestamp: parsed.timestamp,
          rawLevel: parsed.rawLevel,
          calibratedEmpty: parsed.calibratedEmpty,
          calibratedFull: parsed.calibratedFull,
          isPriming: false,
        });

        backfilledCount++;
      }

      logger.info(`Backfilled ${backfilledCount} historical capwater readings from system logs`);
    } catch (error) {
      logger.error(`Failed to backfill historical water readings: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async processWaterLevelData() {
    // Parse capwater sensor data from journalctl logs
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      // Get the latest capwater reading from system logs (from frank process, not bun)
      // Only match lines that include the canonical capwater data pattern
      const { stdout } = await execAsync(
        'journalctl --no-pager --lines=1000 | grep "frank\\[" | grep -E "\\[capwater\\] Raw:" | tail -1'
      );

      if (!stdout.trim()) {
        return;
      }

      const line = stdout.trim();
      const parsed = this.parseCapwaterLogLine(line);
      if (!parsed) {
        // Log the offending line (truncated) to aid debugging but keep noise low
        const sample = line.length > 200 ? `${line.slice(0, 200)}…` : line;
        logger.debug(`Could not parse capwater reading from log line: ${sample}`);
        return;
      }

      const isPriming = this.variableValues.priming === 'true' || this.variableValues.needsPrime !== '0';

      // Build a signature from the parsed values and the source timestamp
      const signature = `${parsed.timestamp}|${parsed.rawLevel}|${parsed.calibratedEmpty}|${parsed.calibratedFull}`;
      if (this.lastCapwaterSignature === signature) {
        // No new data since last check; skip storing duplicates
        return;
      }

      await storeWaterLevelReading({
        // Use the parsed log timestamp so we only insert on actual new readings
        timestamp: parsed.timestamp,
        rawLevel: parsed.rawLevel,
        calibratedEmpty: parsed.calibratedEmpty,
        calibratedFull: parsed.calibratedFull,
        isPriming,
      });

      this.lastCapwaterSignature = signature;

    } catch (error) {
      logger.debug(`Failed to process capwater data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Process room climate (temperature & humidity) data from frank logs
   */
  private async processRoomClimateData() {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      // Get latest ambient reading from frank logs
      const { stdout } = await execAsync(
        'journalctl --no-pager --lines=100 | grep "frank\\[" | grep "\\[ambient\\]" | tail -1'
      );

      if (!stdout.trim()) {
        return;
      }

      const line = stdout.trim();
      const parsed = this.parseRoomClimateLine(line);

      if (parsed) {
        this.roomClimateData = parsed;
      }
    } catch (error) {
      logger.debug(`Failed to process room climate data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get current room climate data
   */
  public getRoomClimateData() {
    return this.roomClimateData;
  }

  private async frankenLoop() {
    while (true) {
      try {
        const franken = await getFranken();

        while (true) {
          await wait(1000);

          const resp = await franken.getVariables();
          // logger.info(`[frankenLoop] resp: ${JSON.stringify(resp)}`, "franken variables");
          this.variableValues = { ...this.variableValues, ...resp };

          await this.processAlarmDismiss();
          await this.processTTC();
          await this.processPrimingState();
          await this.processWaterLevelData();
          await this.processRoomClimateData();
          // await this.updateWaterState(this.variableValues["waterLevel"] == "true");
          // await this.updatePrimeNeeded(parseInt(this.variableValues["needsPrime"], 10));
        }
      } catch (err) {
        logger.error(
          err instanceof Error ? err.message : String(err),
          'franken disconnected',
        );
      }
    }
  }
}
