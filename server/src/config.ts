import { existsSync, mkdirSync, readFileSync } from 'fs';
import logger from './logger.js';


function checkIfDacSockPathConfigured(): string | undefined {
  try {
    // Check if the file exists
    const filePath = '/home/dac/dac_sock_path.txt';
    if (!existsSync(filePath)) {
      logger.debug(`dac.sock path not configured, defaulting to pod 3 path...`);
      return;
    }

    const data = readFileSync(filePath, 'utf8');

    // Remove all newline characters
    return data.replace(/\r?\n/g, '');
  } catch (error) {
    logger.error(error);
  }
}


type FirmwareVersion = 'pod3FirmwareReset' | 'pod4FirmwareReset' | 'remoteDevMode';

interface FirmwareConfig {
  dacLocation: string;
}

const FIRMWARE_MAP: Record<FirmwareVersion, FirmwareConfig> = {
  remoteDevMode: {
    dacLocation: 'lowdb/dac.sock',
  },
  pod3FirmwareReset: {
    dacLocation: '/deviceinfo/dac.sock',
  },
  pod4FirmwareReset: {
    dacLocation: '/persistent/deviceinfo/dac.sock',
  },
};


class Config {
  private static instance: Config;
  public dbFolder: string;
  public remoteDevMode: boolean;
  public dacSockPath: string;
  public analysisFolder: string;
  private constructor() {
    this.remoteDevMode = process.platform === 'darwin';
    this.dacSockPath = this.detectSockPath();
    this.dbFolder = this.remoteDevMode ? '~/free-sleep-database/' : '/home/dac/free-sleep-database/';
    this.analysisFolder = `${this.dbFolder}analysis/`;
    this.initDBFolder();
  }

  private initDBFolder() {
    if (!existsSync(this.dbFolder) || !existsSync(this.analysisFolder)) {
      try {
        logger.debug(`Creating DB folder: ${this.dbFolder}`);
        mkdirSync(this.dbFolder, { recursive: true });
        mkdirSync(this.analysisFolder, { recursive: true });
      } catch (error) {
        console.error(`Failed to create folder: ${this.dbFolder}`, error);
      }
    }
  }

  private detectSockPath(): string {
    const dacSockPath = checkIfDacSockPathConfigured();

    if (dacSockPath) {
      logger.debug(`'Custom dac.sock path configured, using ${dacSockPath}`)
      return dacSockPath;
    } else if (!this.remoteDevMode){
      logger.debug('No dac.sock path configured, defaulting to pod 3 path');
      return FIRMWARE_MAP.pod3FirmwareReset.dacLocation;
    } else if (this.remoteDevMode) {
      return FIRMWARE_MAP.remoteDevMode.dacLocation;
    } else {
      throw new Error('Error - Did not detect device firmware');
    }
  }

  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }
}

export default Config.getInstance();
