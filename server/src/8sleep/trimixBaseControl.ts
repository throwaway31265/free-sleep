import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import logger from '../logger.js';

const execAsync = promisify(exec);

// TriMix protocol constants
const TRIMIX_SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
const TRIMIX_CHAR_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';

// Configuration file path
const BASE_CONFIG_PATH = '/persistent/AdjustableBaseConfiguration.json';

interface BaseConfiguration {
  Address: string;
  SplitBase: boolean;
}

// Angle to ticks conversion maps (from decompiled source)
const TORSO_ANGLE_MAP: Record<number, number> = {
  0: 0,
  5: 128,
  10: 256,
  15: 384,
  20: 533,
  25: 733,
  30: 933,
  35: 1133,
  40: 1333,
  45: 1533,
  50: 1733,
  55: 1933,
  60: 2253,
};

const LEG_ANGLE_MAP: Record<number, number> = {
  0: 0,
  5: 190,
  10: 350,
  15: 540,
  20: 740,
  25: 940,
  30: 1140,
  35: 1340,
  40: 1540,
  45: 1806,
};

// Motor control constants
const MOTOR_CONTROL = {
  RIGHT_LEG: 1,
  RIGHT_TORSO: 2,
  LEFT_LEG: 3,
  LEFT_TORSO: 4,
  BOTH_LEGS: 5,
  BOTH_TORSO: 6,
};

interface BasePosition {
  head: number;
  feet: number;
  feedRate: number;
}

export class TriMixBaseControl {
  private isConnected = false;
  private characteristicPath: string | null = null;
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

      // Build characteristic path
      const macForPath = this.baseAddress.replace(/:/g, '_');
      this.characteristicPath = `/org/bluez/hci0/dev_${macForPath}/service0008/char0009`;

      logger.info('Loaded base configuration:', {
        address: this.baseAddress,
        splitBase: this.baseConfig.SplitBase,
        characteristicPath: this.characteristicPath,
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

        // Enable notifications on the characteristic
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
      
      // Initialize the base after connection
      await this.initializeBase();
      
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
    try {
      logger.info('Enabling notifications on characteristic...');
      const command = `bluetoothctl << EOF
menu gatt
select-attribute ${this.characteristicPath}
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
   * Convert angle to ticks for torso/head
   */
  private angleToTorsoTicks(angle: number): number {
    // Find closest angle in map
    const angles = Object.keys(TORSO_ANGLE_MAP)
      .map(Number)
      .sort((a, b) => a - b);
    const closestAngle = angles.reduce((prev, curr) =>
      Math.abs(curr - angle) < Math.abs(prev - angle) ? curr : prev,
    );
    return TORSO_ANGLE_MAP[closestAngle];
  }

  /**
   * Convert angle to ticks for legs/feet
   */
  private angleToLegTicks(angle: number): number {
    const angles = Object.keys(LEG_ANGLE_MAP)
      .map(Number)
      .sort((a, b) => a - b);
    const closestAngle = angles.reduce((prev, curr) =>
      Math.abs(curr - angle) < Math.abs(prev - angle) ? curr : prev,
    );
    return LEG_ANGLE_MAP[closestAngle];
  }

  /**
   * Initialize the base with required commands
   */
  private async initializeBase(): Promise<void> {
    logger.info('Initializing TriMix base...');
    
    try {
      // Step 1: Reset system flags (command 25, 20, 176)
      logger.info('Resetting system flags...');
      const resetPayload = this.buildTriMixPayload([25, 20, 176]);
      await this.sendCommand(resetPayload);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 2: Query system info (command 32, 20, 160)
      logger.info('Querying system info...');
      const queryPayload = this.buildTriMixPayload([32, 20, 160]);
      await this.sendCommand(queryPayload);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 3: Query current state to verify initialization
      logger.info('Querying current base state...');
      const statePayload = this.buildTriMixPayload([34, 20]); // Command 0x22
      await this.sendCommand(statePayload);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      logger.info('Base initialization complete');
    } catch (error) {
      logger.error('Base initialization error:', error);
      throw error;
    }
  }

  /**
   * Build TriMix command payload
   */
  private buildTriMixPayload(specificValues: number[]): number[] {
    const header = [255, 255, 255, 255, 1, 0];
    const totalLength = 18;
    const padding = totalLength - header.length - specificValues.length;
    const payload = [...header, ...specificValues, ...Array(padding).fill(0)];
    
    // Calculate checksum on the 18-byte payload
    const checksum = payload.reduce((sum, byte) => sum + byte, 0);
    
    // Return 20-byte packet (18 bytes + 2 byte checksum)
    return [...payload, checksum & 0xFF, (checksum >> 8) & 0xFF];
  }

  /**
   * Send command to base via bluetoothctl
   */
  private async sendCommand(payload: number[]): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Not connected to base');
    }

    // Convert payload to individual hex bytes with 0x prefix for bluetoothctl
    const hexBytes = payload
      .map((b) => `0x${b.toString(16).padStart(2, '0')}`)
      .join(' ');

    logger.info('Sending BLE command to base:');
    logger.info(`  Payload bytes: [${payload.join(', ')}]`);
    logger.info(`  Hex string: ${hexBytes}`);

    // Use bluetoothctl to write to characteristic
    // bluetoothctl expects individual hex bytes with 0x prefix
    const command = `bluetoothctl << 'EOF'
menu gatt
select-attribute ${this.characteristicPath}
write ${hexBytes}
back
quit
EOF`;

    try {
      const { stdout, stderr } = await execAsync(command);
      logger.info('Bluetoothctl full response:', stdout);
      if (stderr) {
        logger.warn('Bluetoothctl stderr:', stderr);
      }

      // Check if write was successful
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

    // Convert angles to ticks
    const torsoTicks = this.angleToTorsoTicks(position.head);
    const legTicks = this.angleToLegTicks(position.feet);

    // Set torso angle (both sides)
    await this.setTorsoTicks(position.feedRate, torsoTicks);

    // Wait a bit between commands
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Set leg angle (both sides)
    await this.setLegTicks(position.feedRate, legTicks);
  }

  /**
   * Set torso/head position
   */
  private async setTorsoTicks(feedRate: number, ticks: number): Promise<void> {
    // Command 33 (0x21), motor 6 (both torso)
    // Ticks are little-endian (low byte first)
    const ticksLow = ticks & 0xff;
    const ticksHigh = (ticks >> 8) & 0xff;

    const payload = this.buildTriMixPayload([
      33, // Command (0x21)
      20, // Sub-command (0x14)
      feedRate, // Speed
      MOTOR_CONTROL.BOTH_TORSO, // Motor (6)
      ticksLow, // Ticks low byte
      ticksHigh, // Ticks high byte
    ]);

    logger.info(
      `Setting torso: ticks=${ticks} (0x${ticksLow.toString(16).padStart(2, '0')} 0x${ticksHigh.toString(16).padStart(2, '0')}), feedRate=${feedRate}`,
    );
    await this.sendCommand(payload);
  }

  /**
   * Set leg/feet position
   */
  private async setLegTicks(feedRate: number, ticks: number): Promise<void> {
    // Command 33 (0x21), motor 5 (both legs)
    // Ticks are little-endian (low byte first)
    const ticksLow = ticks & 0xff;
    const ticksHigh = (ticks >> 8) & 0xff;

    const payload = this.buildTriMixPayload([
      33, // Command (0x21)
      20, // Sub-command (0x14)
      feedRate, // Speed
      MOTOR_CONTROL.BOTH_LEGS, // Motor (5)
      ticksLow, // Ticks low byte
      ticksHigh, // Ticks high byte
    ]);

    logger.info(
      `Setting legs: ticks=${ticks} (0x${ticksLow.toString(16).padStart(2, '0')} 0x${ticksHigh.toString(16).padStart(2, '0')}), feedRate=${feedRate}`,
    );
    await this.sendCommand(payload);
  }

  /**
   * Stop all movement
   */
  async stop(): Promise<void> {
    if (!this.isConnected) {
      logger.warn('Cannot stop - not connected to base');
      return;
    }

    const payload = [
      255, 255, 255, 255, 5, 0, 0, 0, 0, 215, 0, 0, 0, 0, 0, 0, 0, 0,
    ];
    await this.sendCommand(payload);
    logger.info('Stopped all base movement');
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
