import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import logger from '../logger.js';

const execAsync = promisify(exec);

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

// --- Command Generation ---

/**
 * Calculates the 2-byte little-endian checksum for a given payload.
 */
function calculateChecksum(payload: Uint8Array): Uint8Array {
  const sum = payload.reduce((acc, byte) => acc + byte, 0);
  const checksum = new Uint8Array(2);
  const view = new DataView(checksum.buffer);
  view.setUint16(0, sum, true); // true for little-endian
  return checksum;
}

/**
 * Appends a checksum to a payload to create the final packet.
 */
function buildPacketWithChecksum(payload: Uint8Array): Uint8Array {
  const checksum = calculateChecksum(payload);
  const packet = new Uint8Array(payload.length + checksum.length);
  packet.set(payload, 0);
  packet.set(checksum, payload.length);
  return packet;
}

/**
 * Creates a command to set a motor to a specific angle.
 */
function createSetAngleCommand(
  motor: 'torso' | 'leg',
  angle: number,
  feedRate: number,
): Uint8Array {
  const payload = new Uint8Array(18).fill(0);
  const view = new DataView(payload.buffer);

  // Magic Header for standard commands
  view.setUint32(0, 0xffffffff, false);
  view.setUint8(4, 0x01);
  view.setUint8(5, 0x00);

  // Command section
  view.setUint8(6, 0x21); // Set Angle/Ticks command
  view.setUint8(7, 0x14);
  view.setUint8(8, feedRate);

  if (motor === 'torso') {
    view.setUint8(9, 0x06); // Torso motor ID
    const ticks = torsoAngleMap.get(angle);
    if (ticks === undefined)
      throw new Error(`Invalid angle ${angle} for torso.`);
    view.setUint16(10, ticks, true); // Ticks (little-endian)
  } else if (motor === 'leg') {
    view.setUint8(9, 0x05); // Leg motor ID
    const ticks = legAngleMap.get(angle);
    if (ticks === undefined) throw new Error(`Invalid angle ${angle} for leg.`);
    view.setUint16(10, ticks, true); // Ticks (little-endian)
  }

  return buildPacketWithChecksum(payload);
}

/**
 * Creates the special command to stop all motor movement.
 */
function createStopCommand(): Uint8Array {
  // This is a special, hardcoded payload from the source code.
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

  constructor() {
    // Will be initialized when we read the config
  }

  /**
   * Load base configuration from file
   */
  private async loadConfiguration(): Promise<boolean> {
    try {
      const configData = await readFile(BASE_CONFIG_PATH, 'utf-8');
      this.baseConfig = JSON.parse(configData) as BaseConfiguration;
      this.baseAddress = this.baseConfig.Address;

      // Build characteristic paths
      const macForPath = this.baseAddress.replace(/:/g, '_');
      this.notifyCharacteristicPath = `/org/bluez/hci0/dev_${macForPath}/service0008/char0009`;
      this.writeCharacteristicPath = `/org/bluez/hci0/dev_${macForPath}/service0008/char000f`;

      logger.info('Loaded base configuration:', {
        address: this.baseAddress,
        splitBase: this.baseConfig.SplitBase,
        notifyPath: this.notifyCharacteristicPath,
        writePath: this.writeCharacteristicPath,
      });

      return true;
    } catch (error) {
      logger.error('Failed to load base configuration:', error);
      return false;
    }
  }

  /**
   * Connect to the base via bluetoothctl
   */
  async connect(): Promise<boolean> {
    try {
      // Load configuration if not already loaded
      if (!this.baseAddress) {
        const configLoaded = await this.loadConfiguration();
        if (!configLoaded) {
          logger.error('Cannot connect - no base configuration found');
          return false;
        }
      }

      logger.info('Connecting to TriMix base...');

      // Check if already connected
      const { stdout: infoOutput } = await execAsync(
        `bluetoothctl info ${this.baseAddress}`,
      );

      if (infoOutput.includes('Connected: yes')) {
        logger.info('Base already connected');
        this.isConnected = true;
        await this.enableNotifications();
        return true;
      }

      // Connect to the base
      await execAsync(`bluetoothctl connect ${this.baseAddress}`);

      // Wait a bit for connection to stabilize
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Enable notifications
      await this.enableNotifications();

      this.isConnected = true;
      logger.info('Successfully connected to TriMix base');
      return true;
    } catch (error) {
      logger.error('Failed to connect to base:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Enable notifications on the characteristic
   */
  private async enableNotifications(): Promise<void> {
    if (!this.notifyCharacteristicPath) {
      logger.error('Notify characteristic path is not set.');
      return;
    }
    try {
      logger.info('Enabling notifications on characteristic...');
      const command = `bluetoothctl << EOF
menu gatt
select-attribute ${this.notifyCharacteristicPath}
notify on
back
quit
EOF`;

      const { stdout } = await execAsync(command);
      logger.debug('Notification enable response:', stdout);
    } catch (error) {
      logger.warn('Failed to enable notifications:', error);
    }
  }

  /**
   * Finds the closest valid angle in the map.
   */
  private getClosestTorsoAngle(angle: number): number {
    const angles = Array.from(torsoAngleMap.keys()).sort((a, b) => a - b);
    return angles.reduce((prev, curr) =>
      Math.abs(curr - angle) < Math.abs(prev - angle) ? curr : prev,
    );
  }

  /**
   * Finds the closest valid angle in the map.
   */
  private getClosestLegAngle(angle: number): number {
    const angles = Array.from(legAngleMap.keys()).sort((a, b) => a - b);
    return angles.reduce((prev, curr) =>
      Math.abs(curr - angle) < Math.abs(prev - angle) ? curr : prev,
    );
  }

  /**
   * Send command to base via bluetoothctl
   */
  private async sendCommand(payload: Uint8Array): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Not connected to base');
    }
    if (!this.writeCharacteristicPath) {
      throw new Error('Write characteristic path is not set.');
    }

    const hexBytes = Array.from(payload)
      .map((b) => `0x${b.toString(16).padStart(2, '0')}`)
      .join(' ');

    logger.info('Sending BLE command to base:');
    logger.info(`  Payload bytes: [${Array.from(payload).join(', ')}]`);
    logger.info(`  Hex string: ${hexBytes}`);

    const command = `bluetoothctl << 'EOF'
menu gatt
select-attribute ${this.writeCharacteristicPath}
write "${hexBytes}"
back
quit
EOF`;

    try {
      const { stdout, stderr } = await execAsync(command);
      logger.info('Bluetoothctl full response:', stdout);
      if (stderr) {
        logger.warn('Bluetoothctl stderr:', stderr);
      }

      if (
        stdout.includes('WriteValue') ||
        stdout.includes('Attempting to write')
      ) {
        logger.info('Write command accepted by bluetoothctl');
      } else if (stdout.includes('Failed') || stdout.includes('Error')) {
        logger.error('Write command failed - check bluetoothctl output above');
      }
    } catch (error) {
      logger.error('Failed to send command:', error);
      throw error;
    }
  }

  /**
   * Check if base is configured
   */
  async isConfigured(): Promise<boolean> {
    try {
      await readFile(BASE_CONFIG_PATH, 'utf-8');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Set base position (both sides synchronized)
   */
  async setPosition(position: BasePosition): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    logger.info('Setting base position:', position);

    try {
      // Set torso angle
      const torsoAngle = this.getClosestTorsoAngle(position.head);
      const torsoCommand = createSetAngleCommand(
        'torso',
        torsoAngle,
        position.feedRate,
      );
      logger.info(
        `Setting torso to angle ${torsoAngle} (requested ${position.head})`,
      );
      await this.sendCommand(torsoCommand);

      // Wait a bit between commands
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Set leg angle
      const legAngle = this.getClosestLegAngle(position.feet);
      const legCommand = createSetAngleCommand(
        'leg',
        legAngle,
        position.feedRate,
      );
      logger.info(
        `Setting leg to angle ${legAngle} (requested ${position.feet})`,
      );
      await this.sendCommand(legCommand);
    } catch (error) {
      logger.error(`Failed to set position: ${error}`);
      throw error;
    }
  }

  /**
   * Stop all movement
   */
  async stop(): Promise<void> {
    if (!this.isConnected) {
      logger.warn('Cannot stop - not connected to base');
      return;
    }
    logger.info('Stopping all base movement');
    const command = createStopCommand();
    await this.sendCommand(command);
  }

  /**
   * Go to flat position
   */
  async goToFlat(): Promise<void> {
    await this.setPosition({ head: 0, feet: 0, feedRate: 50 });
  }

  /**
   * Disconnect from base
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected || !this.baseAddress) {
      return;
    }

    try {
      await execAsync(`bluetoothctl disconnect ${this.baseAddress}`);
      this.isConnected = false;
      logger.info('Disconnected from base');
    } catch (error) {
      logger.error('Error disconnecting:', error);
    }
  }
}

// Singleton instance
export const trimixBase = new TriMixBaseControl();
