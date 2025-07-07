import { ChildProcess, spawn } from 'child_process';
import { readFile } from 'fs/promises';
import memoryDB from '../db/memoryDB.js';
import logger from '../logger.js';

// Configuration file path
const BASE_CONFIG_PATH = '/persistent/AdjustableBaseConfiguration.json';

interface BaseConfiguration {
  Address: string;
  SplitBase: boolean;
}

// --- Angle-to-Ticks conversion maps from C# source ---
const torsoAngleMap = new Map<number, number>([
  [0, 0],
  [1, 24],
  [2, 48],
  [3, 72],
  [4, 96],
  [5, 120],
  [6, 144],
  [7, 168],
  [8, 192],
  [9, 216],
  [10, 240],
  [11, 264],
  [12, 288],
  [13, 312],
  [14, 336],
  [15, 360],
  [16, 384],
  [17, 408],
  [18, 432],
  [19, 456],
  [20, 533],
  [21, 556],
  [22, 579],
  [23, 602],
  [24, 625],
  [25, 648],
  [26, 671],
  [27, 694],
  [28, 717],
  [29, 740],
  [30, 763],
  [31, 786],
  [32, 809],
  [33, 832],
  [34, 855],
  [35, 878],
  [36, 901],
  [37, 924],
  [38, 947],
  [39, 970],
  [40, 993],
  [41, 1016],
  [42, 1039],
  [43, 1062],
  [44, 1085],
  [45, 1108],
  [46, 1131],
  [47, 1154],
  [48, 1177],
  [49, 1200],
  [50, 1223],
  [51, 1246],
  [52, 1269],
  [53, 1292],
  [54, 1315],
  [55, 1338],
  [56, 1361],
  [57, 1384],
  [58, 1407],
  [59, 1430],
  [60, 2253],
]);

const legAngleMap = new Map<number, number>([
  [0, 0],
  [1, 38],
  [2, 76],
  [3, 114],
  [4, 152],
  [5, 190],
  [6, 222],
  [7, 254],
  [8, 286],
  [9, 318],
  [10, 350],
  [11, 404],
  [12, 458],
  [13, 512],
  [14, 566],
  [15, 540],
  [16, 594],
  [17, 648],
  [18, 702],
  [19, 756],
  [20, 740],
  [21, 784],
  [22, 828],
  [23, 872],
  [24, 916],
  [25, 960],
  [26, 1004],
  [27, 1048],
  [28, 1092],
  [29, 1136],
  [30, 1180],
  [31, 1224],
  [32, 1268],
  [33, 1312],
  [34, 1356],
  [35, 1400],
  [36, 1444],
  [37, 1488],
  [38, 1532],
  [39, 1576],
  [40, 1620],
  [41, 1664],
  [42, 1708],
  [43, 1752],
  [44, 1796],
  [45, 1806],
]);

// --- Ticks-to-Angle Conversion ---
function ticksToAngle(ticks: number, map: Map<number, number>): number {
  let closestAngle = 0;
  let smallestDiff = Infinity;

  for (const [angle, mapTicks] of map.entries()) {
    const diff = Math.abs(ticks - mapTicks);
    if (diff < smallestDiff) {
      smallestDiff = diff;
      closestAngle = angle;
    }
  }
  return closestAngle;
}

function ticksToTorsoAngle(ticks: number): number {
  return ticksToAngle(ticks, torsoAngleMap);
}

function ticksToLegAngle(ticks: number): number {
  return ticksToAngle(ticks, legAngleMap);
}

// --- Command Generation ---
function calculateChecksum(payload: Uint8Array): Uint8Array {
  const sum = payload.reduce((acc, byte) => acc + byte, 0);
  const checksum = new Uint8Array(2);
  const view = new DataView(checksum.buffer);
  view.setUint16(0, sum, true);
  return checksum;
}

function buildPacketWithChecksum(payload: Uint8Array): Uint8Array {
  const checksum = calculateChecksum(payload);
  const packet = new Uint8Array(payload.length + checksum.length);
  packet.set(payload, 0);
  packet.set(checksum, payload.length);
  return packet;
}

function createSetAngleCommand(
  motor: 'torso' | 'leg',
  angle: number,
  feedRate: number,
): Uint8Array {
  const payload = new Uint8Array(18).fill(0);
  const view = new DataView(payload.buffer);
  view.setUint32(0, 0xffffffff, false);
  view.setUint8(4, 0x01);
  view.setUint8(5, 0x00);
  view.setUint8(6, 0x21);
  view.setUint8(7, 0x14);
  view.setUint8(8, feedRate);

  if (motor === 'torso') {
    view.setUint8(9, 0x06);
    const ticks = torsoAngleMap.get(angle);
    if (ticks === undefined)
      throw new Error(`Invalid angle ${angle} for torso.`);
    view.setUint16(10, ticks, true);
  } else if (motor === 'leg') {
    view.setUint8(9, 0x05);
    const ticks = legAngleMap.get(angle);
    if (ticks === undefined) throw new Error(`Invalid angle ${angle} for leg.`);
    view.setUint16(10, ticks, true);
  }
  return buildPacketWithChecksum(payload);
}

function createStopCommand(): Uint8Array {
  const payload = new Uint8Array([255, 255, 255, 255, 5, 0, 0, 0, 0, 215, 0]);
  return buildPacketWithChecksum(payload);
}

interface BasePosition {
  head: number;
  feet: number;
  feedRate: number;
}

export class TriMixBaseControl {
  private isConnected = false;
  private notifyCharacteristicPath: string | null = null;
  private writeCharacteristicPath: string | null = null;
  private baseAddress: string | null = null;
  private baseConfig: BaseConfiguration | null = null;
  private bleProcess: ChildProcess | null = null;
  private inGattMenu = false;
  private notificationBuffer: number[] = [];

  constructor() {
    this.initialize();
  }

  /**
   * Load configuration and start the BLE management process.
   */
  async initialize(): Promise<void> {
    const configLoaded = await this.loadConfiguration();
    if (!configLoaded) {
      logger.error('Failed to load base configuration. Retrying in 30s...');
      setTimeout(() => this.initialize(), 30000);
      return;
    }
    this.startBleProcess();
  }

  /**
   * Load base configuration from file.
   */
  private async loadConfiguration(): Promise<boolean> {
    try {
      const configData = await readFile(BASE_CONFIG_PATH, 'utf-8');
      this.baseConfig = JSON.parse(configData) as BaseConfiguration;
      this.baseAddress = this.baseConfig.Address;
      const macForPath = this.baseAddress.replace(/:/g, '_');
      this.notifyCharacteristicPath = `/org/bluez/hci0/dev_${macForPath}/service0008/char0009`;
      this.writeCharacteristicPath = `/org/bluez/hci0/dev_${macForPath}/service0008/char000f`;
      logger.info('Loaded base configuration:', { address: this.baseAddress });
      return true;
    } catch (error) {
      logger.error('Failed to load base configuration:', error);
      return false;
    }
  }

  /**
   * Spawns and manages the bluetoothctl process.
   */
  private startBleProcess(): void {
    if (this.bleProcess) {
      logger.info('Bluetoothctl process is already running.');
      return;
    }
    logger.info('Starting bluetoothctl process...');
    this.bleProcess = spawn('bluetoothctl', [], { shell: true });

    this.bleProcess.stdout?.on('data', (data: Buffer) => {
      this.handleBleOutput(data.toString());
    });

    this.bleProcess.stderr?.on('data', (data: Buffer) => {
      logger.error(`bluetoothctl stderr: ${data.toString()}`);
    });

    this.bleProcess.on('close', (code) => {
      logger.warn(
        `bluetoothctl process exited with code ${code}. Restarting in 5s.`,
      );
      this.bleProcess = null;
      this.isConnected = false;
      this.inGattMenu = false;
      setTimeout(() => this.startBleProcess(), 5000);
    });

    // Initial connection command
    this.sendCommandToProcess(`connect ${this.baseAddress}`);
  }

  /**
   * Handles raw output from bluetoothctl, extracts hex, and adds to buffer.
   */
  private handleBleOutput(output: string): void {
    if (!this.isConnected && output.includes('Connection successful')) {
      this.isConnected = true;
      logger.info('Base connected. Enabling notifications...');
      this.enableNotificationsViaProcess();
    }

    if (output.includes('Menu gatt:')) {
      this.inGattMenu = true;
    }

    // Process each line separately to extract hex data
    const lines = output.split('\n');
    for (const line of lines) {
      // Strip ANSI escape codes and other control characters from the line
      const cleanLine = line
        // biome-ignore lint/suspicious/noControlCharactersInRegex: <explanation>
        .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '') // Remove ANSI escape sequences
        // biome-ignore lint/suspicious/noControlCharactersInRegex: <explanation>
        .replace(/\u0001\u001b\[.*?\u0001\u001b\[.*?\u0002/g, '') // Remove specific color codes
        // biome-ignore lint/suspicious/noControlCharactersInRegex: <explanation>
        .replace(/\u0001.*?\u0002/g, '') // Remove other control sequences
        .replace(/\r/g, '') // Remove carriage returns
        .replace(/\[[^\]]*\]/g, ''); // Remove any remaining bracket sequences

      // Extract hex pairs only from notification data lines that contain hex data
      // Allow for various prefixes (# + spaces, just spaces, etc.)
      if (cleanLine.match(/^[#\s]*[0-9a-fA-F]{2}( [0-9a-fA-F]{2})*\s+.*$/)) {
        const hexPairs = cleanLine.match(/[0-9a-fA-F]{2}/g);
        if (hexPairs) {
          const newBytes = hexPairs.map((s) => parseInt(s, 16));
          this.notificationBuffer.push(...newBytes);
          this.processNotificationBuffer();
        }
      }
    }
  }

  /**
   * Processes the byte buffer to find and parse complete packets.
   */
  private processNotificationBuffer(): void {
    // A complete packet is 20 bytes long.
    while (this.notificationBuffer.length >= 20) {
      // Find the start of a packet (0xff ff ff ff)
      const startIndex = this.notificationBuffer.findIndex(
        (_byte, i) =>
          this.notificationBuffer[i] === 0xff &&
          this.notificationBuffer[i + 1] === 0xff &&
          this.notificationBuffer[i + 2] === 0xff &&
          this.notificationBuffer[i + 3] === 0xff,
      );

      if (startIndex === -1) {
        // No header found, clear buffer to avoid infinite loop on bad data
        this.notificationBuffer = [];
        return;
      }

      // Discard any data before the packet header
      if (startIndex > 0) {
        this.notificationBuffer.splice(0, startIndex);
      }

      // Check if we have a full packet after finding the header
      if (this.notificationBuffer.length < 20) {
        return;
      }

      const packet = new Uint8Array(this.notificationBuffer.slice(0, 20));
      const payload = packet.slice(0, 18);
      const view = new DataView(packet.buffer);
      const receivedChecksum = view.getUint16(18, true); // little-endian

      const calculatedSum = payload.reduce((acc, byte) => acc + byte, 0);
      const calculatedChecksum = calculatedSum & 0xffff; // Keep only lower 16 bits

      if (calculatedChecksum === receivedChecksum) {
        // We have a valid packet
        this.parseNotification(packet);
        // Remove the processed packet from the buffer
        this.notificationBuffer.splice(0, 20);
      } else {
        // Checksum is invalid. Clear the entire buffer and start fresh
        this.notificationBuffer = [];
      }
    }
  }

  /**
   * Sends commands to enable notifications via the persistent process.
   */
  private enableNotificationsViaProcess(): void {
    this.sendCommandToProcess('menu gatt');
    this.sendCommandToProcess(
      `select-attribute ${this.notifyCharacteristicPath}`,
    );
    this.sendCommandToProcess('notify on');
  }

  /**
   * Decodes a validated notification packet and updates the database.
   */
  private lastPosition = { head: -1, feet: -1 };
  private movementTimeout: Timer | null = null;

  private parseNotification(packet: Uint8Array): void {
    const view = new DataView(packet.buffer);
    const packetType = view.getUint8(6);

    if (!memoryDB.data) return;

    if (packetType === 0x22) {
      // Position State Packet
      const leftTorsoTicks = view.getUint16(11, true);
      const rightTorsoTicks = view.getUint16(15, true);
      const leftLegTicks = view.getUint16(9, true);
      const rightLegTicks = view.getUint16(13, true);

      const avgTorsoTicks = Math.round((leftTorsoTicks + rightTorsoTicks) / 2);
      const avgLegTicks = Math.round((leftLegTicks + rightLegTicks) / 2);

      const headAngle = ticksToTorsoAngle(avgTorsoTicks);
      const feetAngle = ticksToLegAngle(avgLegTicks);

      // Detect movement by comparing with last known position
      const positionChanged =
        this.lastPosition.head !== headAngle ||
        this.lastPosition.feet !== feetAngle;

      if (positionChanged) {
        // Position changed - base is moving
        this.lastPosition = { head: headAngle, feet: feetAngle };

        // Clear any existing timeout
        if (this.movementTimeout) {
          clearTimeout(this.movementTimeout);
        }

        // Set timeout to detect when movement stops (no position updates for 3 seconds)
        this.movementTimeout = setTimeout(() => {
          if (memoryDB.data?.baseStatus) {
            memoryDB.data.baseStatus.isMoving = false;
            memoryDB.data.baseStatus.lastUpdate = new Date().toISOString();
            memoryDB.write();
          }
        }, 3000);
      }

      if (!memoryDB.data.baseStatus) {
        memoryDB.data.baseStatus = {
          head: headAngle,
          feet: feetAngle,
          isMoving: positionChanged,
          lastUpdate: new Date().toISOString(),
          isConfigured: true,
        };
      } else {
        memoryDB.data.baseStatus.head = headAngle;
        memoryDB.data.baseStatus.feet = feetAngle;
        memoryDB.data.baseStatus.isMoving =
          positionChanged || memoryDB.data.baseStatus.isMoving;
        memoryDB.data.baseStatus.lastUpdate = new Date().toISOString();
      }
      memoryDB.write();
    }
  }

  /**
   * Writes a command to the stdin of the bluetoothctl process.
   */
  private sendCommandToProcess(command: string): void {
    if (!this.bleProcess) {
      logger.error('Cannot send command, bluetoothctl process is not running.');
      return;
    }
    logger.info(`> ${command}`);
    this.bleProcess.stdin?.write(`${command}\n`);
  }

  /**
   * Sends a command payload to the base.
   */
  private async sendPayload(payload: Uint8Array): Promise<void> {
    if (!this.isConnected) throw new Error('Not connected to base');
    if (!this.writeCharacteristicPath)
      throw new Error('Write characteristic path is not set.');

    const hexBytes = Array.from(payload)
      .map((b) => `0x${b.toString(16).padStart(2, '0')}`)
      .join(' ');

    logger.info('Sending command payload:', hexBytes);
    if (!this.inGattMenu) {
      this.sendCommandToProcess('menu gatt');
    }
    this.sendCommandToProcess(
      `select-attribute ${this.writeCharacteristicPath}`,
    );
    this.sendCommandToProcess(`write "${hexBytes}"`);
    // Return to listening on the notification characteristic
    this.sendCommandToProcess(
      `select-attribute ${this.notifyCharacteristicPath}`,
    );
  }

  async isConfigured(): Promise<boolean> {
    try {
      await readFile(BASE_CONFIG_PATH, 'utf-8');
      return true;
    } catch {
      return false;
    }
  }

  async setPosition(position: BasePosition): Promise<void> {
    logger.info('Setting base position:', position);
    try {
      const torsoAngle = this.getClosestAngle(position.head, torsoAngleMap);
      const legAngle = this.getClosestAngle(position.feet, legAngleMap);

      const torsoCommand = createSetAngleCommand(
        'torso',
        torsoAngle,
        position.feedRate,
      );
      await this.sendPayload(torsoCommand);
      await new Promise((resolve) => setTimeout(resolve, 500));
      const legCommand = createSetAngleCommand(
        'leg',
        legAngle,
        position.feedRate,
      );
      await this.sendPayload(legCommand);
    } catch (error) {
      logger.error(`Failed to set position: ${error}`);
      throw error;
    }
  }

  private getClosestAngle(angle: number, map: Map<number, number>): number {
    const angles = Array.from(map.keys()).sort((a, b) => a - b);
    return angles.reduce((prev, curr) =>
      Math.abs(curr - angle) < Math.abs(prev - angle) ? curr : prev,
    );
  }

  async stop(): Promise<void> {
    logger.info('Stopping all base movement');
    const command = createStopCommand();
    await this.sendPayload(command);
  }

  async goToFlat(): Promise<void> {
    await this.setPosition({ head: 0, feet: 0, feedRate: 50 });
  }
}

export const trimixBase = new TriMixBaseControl();
