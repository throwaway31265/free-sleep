import { readdirSync, statSync, openSync, readSync, closeSync } from 'fs';
import { join } from 'path';
import cbor from 'cbor';
import moment from 'moment-timezone';
import logger from '../logger.js';
import settingsDB from '../db/settings.js';
import { updateDeviceStatus } from '../routes/deviceStatus/updateDeviceStatus.js';
import { DeviceStatus } from '../routes/deviceStatus/deviceStatusSchema.js';
import { DeepPartial } from 'ts-essentials';
import { Side } from '../db/schedulesSchema.js';
import { Gesture } from '../db/settingsSchema.js';
import { connectFranken } from './frankenServer.js';
import { executeFunction } from './deviceApi.js';

const RAW_FILE_PATH = '/persistent';
const POLL_INTERVAL_MS = 2000;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB max file size to read
// Read overlap to handle CBOR records that might span boundaries
// CBOR records are typically small, 64KB overlap should be plenty
const READ_OVERLAP = 64 * 1024;

interface TapGestureEvent {
  type: 'tap-gesture';
  ts: number;
  side: 'left' | 'right';
  taps: number;
}

export class RawTapMonitor {
  private isRunning = false;
  private lastProcessedTimestamp = 0;
  private lastFileName = '';
  private lastFileSize = 0; // Track file size for incremental reads
  private initialized = false;

  public async start() {
    if (this.isRunning) {
      logger.warn('RawTapMonitor is already running');
      return;
    }
    this.isRunning = true;
    logger.info('RawTapMonitor started');

    // On startup, scan existing events to find the latest timestamp
    // This prevents processing old events on restart
    await this.initializeFromExistingEvents();

    this.monitorLoop();
  }

  private async initializeFromExistingEvents() {
    const rawFile = this.getLatestRawFile();
    if (!rawFile) {
      this.initialized = true;
      return;
    }

    logger.info('[RawTapMonitor] Scanning existing events to find latest timestamp...');
    const events = await this.readNewTapEvents(rawFile);

    // Find the max timestamp from existing events
    for (const event of events) {
      this.lastProcessedTimestamp = Math.max(this.lastProcessedTimestamp, event.ts);
    }

    // Note: lastFileSize is already set by readNewTapEvents
    logger.info(`[RawTapMonitor] Initialized: skipping ${events.length} existing events, lastTs=${this.lastProcessedTimestamp}, lastFileSize=${this.lastFileSize}`);
    this.initialized = true;
  }

  public stop() {
    this.isRunning = false;
    logger.info('RawTapMonitor stopped');
  }

  private getLatestRawFile(): string | null {
    try {
      const files = readdirSync(RAW_FILE_PATH)
        .filter(f => f.endsWith('.RAW') && !f.startsWith('SEQ'))
        .map(f => ({
          name: f,
          path: join(RAW_FILE_PATH, f),
          mtime: statSync(join(RAW_FILE_PATH, f)).mtime.getTime()
        }))
        .sort((a, b) => b.mtime - a.mtime);

      return files.length > 0 ? files[0].path : null;
    } catch (error) {
      logger.error('Error finding RAW file:', error);
      return null;
    }
  }

  private async readNewTapEvents(filePath: string): Promise<TapGestureEvent[]> {
    // Reset state if file changed
    if (filePath !== this.lastFileName) {
      logger.info(`[RawTapMonitor] RAW file changed: ${this.lastFileName} -> ${filePath}`);
      this.lastProcessedTimestamp = 0;
      this.lastFileSize = 0;
      this.lastFileName = filePath;
    }

    try {
      const fileStats = statSync(filePath);
      const currentFileSize = fileStats.size;

      if (currentFileSize > MAX_FILE_SIZE) {
        logger.warn(`[RawTapMonitor] File too large (${currentFileSize} bytes), skipping`);
        return [];
      }

      // Skip if file hasn't grown since last read (after initialization)
      if (this.initialized && this.lastFileSize > 0) {
        if (currentFileSize <= this.lastFileSize) {
          return [];
        }
      }

      // Read entire file - CBOR decoder needs to start from valid record boundary
      // Partial reads starting mid-record corrupt decoder state
      const buffer = Buffer.alloc(currentFileSize);
      const fd = openSync(filePath, 'r');
      try {
        readSync(fd, buffer, 0, currentFileSize, 0);
      } finally {
        closeSync(fd);
      }

      // Update last file size after successful read
      this.lastFileSize = currentFileSize;

      // Decode CBOR records using streaming decoder
      const events: TapGestureEvent[] = [];
      const decoder = new cbor.Decoder();

      decoder.on('data', (outer: { data?: Buffer }) => {
        try {
          if (outer && outer.data) {
            const inner = cbor.decode(outer.data);
            if (inner && inner.type === 'tap-gesture') {
              if (inner.ts > this.lastProcessedTimestamp) {
                events.push({
                  type: 'tap-gesture',
                  ts: inner.ts,
                  side: inner.side,
                  taps: inner.taps
                });
              }
            }
          }
        } catch {
          // Skip malformed inner records
        }
      });

      decoder.on('error', () => {
        // Ignore decoder errors (expected when reading from mid-record)
      });

      decoder.write(buffer);
      try {
        decoder.end();
      } catch {
        // Ignore end errors
      }

      if (events.length > 0) {
        logger.debug(`[RawTapMonitor] Found ${events.length} new tap events in ${currentFileSize} bytes`);
      }

      return events;
    } catch (error) {
      logger.error('[RawTapMonitor] Error reading tap events:', error);
      return [];
    }
  }

  private mapTapsToGesture(taps: number): Gesture | null {
    switch (taps) {
      case 2: return 'doubleTap';
      case 3: return 'tripleTap';
      case 4: return 'quadTap';
      default: return null;
    }
  }

  private async vibrateAcknowledgment(side: Side) {
    try {
      await settingsDB.read();
      const currentTime = moment.tz(settingsDB.data.timeZone);
      const alarmTimeEpoch = currentTime.unix();

      const alarmPayload = {
        pl: 100,       // vibration intensity (100%)
        du: 2,         // duration in seconds
        pi: 'double',  // vibration pattern
        tt: alarmTimeEpoch,
      };

      const cborPayload = cbor.encode(alarmPayload);
      const hexPayload = cborPayload.toString('hex');
      const command = side === 'left' ? 'ALARM_LEFT' : 'ALARM_RIGHT';

      logger.debug(`[RawTapMonitor] Sending acknowledgment vibration on ${side}`);
      await executeFunction(command, hexPayload);
    } catch (error) {
      logger.error('[RawTapMonitor] Error sending acknowledgment vibration:', error);
    }
  }

  private async processGesture(side: Side, gesture: Gesture, pendingTemps: Map<Side, number>): Promise<void> {
    try {
      // Send acknowledgment vibration first
      await this.vibrateAcknowledgment(side);

      await settingsDB.read();
      const behavior = settingsDB.data[side].taps[gesture];

      if (behavior.type === 'temperature') {
        // Use pending temp if we've already adjusted this side in this batch,
        // otherwise fetch from device
        let currentTemperatureTarget: number;
        if (pendingTemps.has(side)) {
          currentTemperatureTarget = pendingTemps.get(side)!;
        } else {
          const franken = await connectFranken();
          const deviceStatus = await franken.getDeviceStatus(false);
          currentTemperatureTarget = deviceStatus[side].targetTemperatureF;
        }

        let newTemperatureTargetF: number;
        const change = behavior.amount;

        if (behavior.change === 'increment') {
          newTemperatureTargetF = currentTemperatureTarget + change;
        } else {
          newTemperatureTargetF = currentTemperatureTarget - change;
        }

        // Track the pending temperature for subsequent events in this batch
        pendingTemps.set(side, newTemperatureTargetF);

        logger.info(`[RawTapMonitor] Processing ${gesture} on ${side}: ${currentTemperatureTarget}°F -> ${newTemperatureTargetF}°F`);

        await updateDeviceStatus({
          [side]: { targetTemperatureF: newTemperatureTargetF }
        } as DeepPartial<DeviceStatus>);
      } else if (behavior.type === 'alarm') {
        logger.info(`[RawTapMonitor] Alarm gesture detected on ${side}: ${behavior.behavior}`);
        // TODO: Implement alarm handling
      }
    } catch (error) {
      logger.error('[RawTapMonitor] Error processing gesture:', error);
    }
  }

  private async monitorLoop() {
    while (this.isRunning) {
      try {
        const rawFile = this.getLatestRawFile();

        if (rawFile) {
          const tapEvents = await this.readNewTapEvents(rawFile);

          // Track pending temps for this batch to handle multiple events correctly
          const pendingTemps = new Map<Side, number>();

          for (const event of tapEvents) {
            const gesture = this.mapTapsToGesture(event.taps);
            if (gesture) {
              logger.debug(`[RawTapMonitor] Detected ${gesture} on ${event.side} at ts=${event.ts}`);
              await this.processGesture(event.side as Side, gesture, pendingTemps);
            }
            this.lastProcessedTimestamp = Math.max(this.lastProcessedTimestamp, event.ts);
          }
        }
      } catch (error) {
        logger.error('[RawTapMonitor] Error in monitor loop:', error);
      }

      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
}

// Singleton instance
export const rawTapMonitor = new RawTapMonitor();
