import type { Socket } from 'net';
import config from '../config.js';
import logger from '../logger.js';
import type { DeviceStatus } from '../routes/deviceStatus/deviceStatusSchema.js';
import { type FrankenCommand, frankenCommands } from './deviceApi.js';
import { loadDeviceStatus } from './loadDeviceStatus.js';
import { MessageStream } from './messageStream.js';
import {
  type PromiseStream,
  PromiseStreams,
  type PromiseWriteStream,
} from './promiseStream.js';
import { wait } from './promises.js';
import { SequentialQueue } from './sequentialQueue.js';
import { UnixSocketServer } from './unixSocketServer.js';

// Helper function to create timeout promises
function createTimeout<T = never>(ms: number, message: string): Promise<T> {
  return new Promise<T>((_, reject) =>
    setTimeout(() => reject(new Error(message)), ms)
  );
}

export class Franken {
  public constructor(
    private readonly writeStream: PromiseWriteStream<Buffer>,
    private readonly messageStream: MessageStream,
    private readonly sequentialQueue: SequentialQueue,
    private readonly socket: Socket,
  ) {}

  static readonly separator = Buffer.from('\n\n');

  public async sendMessage(message: string, timeoutMs: number = 5000) {
    if (message !== `14`) {
      logger.debug(`Sending message to sock | message: ${message}`);
    }

    const messageTimeout = createTimeout(timeoutMs, `Message timeout after ${timeoutMs}ms`);

    try {
      const responseBytes = await Promise.race([
        this.sequentialQueue.exec(async () => {
          const requestBytes = Buffer.concat([
            Buffer.from(message),
            Franken.separator,
          ]);
          await this.writeStream.write(requestBytes);
          const resp = await this.messageStream.readMessage();

          await wait(50);
          return resp;
        }),
        messageTimeout
      ]);

      const response = responseBytes.toString();
      if (message !== `14`) {
        logger.debug(`Message sent successfully to sock | message: ${message}`);
      }

      return response;
    } catch (error) {
      logger.error(`Failed to send message: ${message}`, error);
      throw error;
    }
  }

  private tryStripNewlines(arg: string) {
    const containsNewline = arg.indexOf('\n') >= 0;
    if (!containsNewline) return arg;
    return arg.replace(/\n/gm, '');
  }

  public async callFunction(command: FrankenCommand, arg: string) {
    logger.debug(`Calling function | command: ${command} | arg: ${arg}`);
    const commandNumber = frankenCommands[command];
    const cleanedArg = this.tryStripNewlines(arg);
    logger.debug(`commandNumber: ${commandNumber}`);
    logger.debug(`cleanedArg: ${cleanedArg}`);
    await this.sendMessage(`${commandNumber}\n${cleanedArg}`);
  }

  public async getVariables() {
    const command: FrankenCommand = 'DEVICE_STATUS';
    const commandNumber = frankenCommands[command];
    const varResp = await this.sendMessage(commandNumber);
    const parsedVars = Object.fromEntries(
      varResp.split('\n').map((l) => l.split(' = ')),
    );
    return parsedVars as { [k: string]: string };
  }

  public async getDeviceStatus(): Promise<DeviceStatus> {
    const command: FrankenCommand = 'DEVICE_STATUS';
    const commandNumber = frankenCommands[command];
    const response = await this.sendMessage(commandNumber);
    return await loadDeviceStatus(response);
  }

  public close() {
    const socket = this.socket;
    if (!socket.destroyed) socket.destroy();
  }

  public static fromSocket(socket: Socket) {
    // @ts-expect-error - Mismatched types
    const stream: PromiseStream<any> = PromiseStreams.toPromise(socket);
    const messageStream = new MessageStream(stream, Franken.separator);
    return new Franken(stream, messageStream, new SequentialQueue(), socket);
  }
}

class FrankenServer {
  public constructor(private readonly server: UnixSocketServer) {}

  public async close() {
    logger.debug('Closing FrankenServer socket...');
    await this.server.close();
  }

  public async waitForFranken(): Promise<Franken> {
    const socket = await this.server.waitForConnection();
    logger.debug('FrankenServer connected');
    return Franken.fromSocket(socket);
  }

  public static async start(path: string) {
    logger.debug(`Creating franken server on socket: ${config.dacSockPath}`);
    const unixSocketServer = await UnixSocketServer.start(path);
    return new FrankenServer(unixSocketServer);
  }
}

let frankenServer: FrankenServer | undefined;
let frankenServerPromise: Promise<FrankenServer> | undefined;

export async function getFrankenServer(): Promise<FrankenServer> {
  // If we've already started it, reuse:
  if (frankenServer) {
    logger.debug('FrankenServer already started in getFrankenServer');
    return frankenServer;
  } else {
    logger.debug('FrankenServer not started in getFrankenServer');
  }
  // Otherwise, start a new instance once:
  if (!frankenServerPromise) {
    logger.debug('FrankenServer not started in getFrankenServer');
    frankenServerPromise = (async () => {
      const server = await FrankenServer.start(config.dacSockPath);
      logger.debug('FrankenServer started');
      frankenServer = server;
      return server;
    })();
  }
  return frankenServerPromise;
}

let franken: Franken | undefined;

export async function getFranken(): Promise<Franken> {
  if (franken) {
    logger.debug('Franken already started in getFranken');
    return franken;
  } else {
    logger.debug('Franken not started in getFranken');
  }

  const frankenServer = await getFrankenServer();

  // Add timeout for waiting for franken connection
  const connectionTimeout = createTimeout(5000, 'Franken connection timeout');

  try {
    franken = await Promise.race([
      frankenServer.waitForFranken(),
      connectionTimeout
    ]);
    return franken;
  } catch (error) {
    logger.error('Failed to connect to Franken:', error);
    throw error;
  }
}
