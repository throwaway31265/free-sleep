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
import { wait, withTimeout } from './promises.js';
import { SequentialQueue } from './sequentialQueue.js';
import { UnixSocketServer } from './unixSocketServer.js';

export class Franken {
  public constructor(
    private readonly writeStream: PromiseWriteStream<Buffer>,
    private readonly messageStream: MessageStream,
    private readonly sequentialQueue: SequentialQueue,
    private readonly socket: Socket,
  ) {}

  static readonly separator = Buffer.from('\n\n');

  public async sendMessage(message: string, timeoutMs = 5000) {
    // Check if socket is destroyed before attempting to send
    if (this.socket.destroyed) {
      throw new Error('Socket is destroyed, cannot send message');
    }

    if (message !== `14`) {
      logger.debug(`Sending message to sock | message: ${message}`);
    }
    const responseBytes = await withTimeout(
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
      timeoutMs,
      `Timeout sending message to frank.service: ${message}`,
    );
    const response = responseBytes.toString();
    if (message !== `14`) {
      logger.debug(`Message sent successfully to sock | message: ${message}`);
    }

    return response;
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

export function isFrankReady(): boolean {
  if (!franken) {
    return false;
  }
  const socket = (franken as any).socket;
  return socket && !socket.destroyed;
}

export async function getFranken(): Promise<Franken> {
  // Check if existing franken instance has a destroyed socket
  if (franken) {
    const socket = (franken as any).socket;
    if (socket && socket.destroyed) {
      logger.debug('Franken socket was destroyed, resetting connection');
      franken = undefined;
    } else {
      logger.debug('Franken already started in getFranken');
      return franken;
    }
  }

  if (!franken) {
    logger.debug('Franken not started in getFranken');
  }
  const frankenServer = await getFrankenServer();
  franken = await frankenServer.waitForFranken();
  return franken;
}
