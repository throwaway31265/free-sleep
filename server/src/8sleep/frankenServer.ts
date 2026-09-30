import { Socket } from 'net';

import { SequentialQueue } from './sequentialQueue.js';
import { MessageReadTimeoutError, MessageStream } from './messageStream.js';
import { FrankenCommand, frankenCommands } from './deviceApi.js';

import { UnixSocketServer } from './unixSocketServer.js';
import logger from '../logger.js';
import { DeviceStatus } from '../routes/deviceStatus/deviceStatusSchema.js';
import { loadDeviceStatus } from './loadDeviceStatus.js';
import config from '../config.js';
import { toPromise, wait } from './promises.js';

const FRANKEN_CONNECTION_TIMEOUT_MS = 25_000;
const FRANKEN_CONNECTION_MAX_ATTEMPTS = 10;
const FRANKEN_RESPONSE_TIMEOUT_MS = 10_000;

class FrankenConnectionTimeoutError extends Error {
  public constructor() {
    super('Timed out waiting for Franken hardware connection');
    this.name = 'FrankenConnectionTimeoutError';
  }
}

class FrankenConnectionFailedError extends Error {
  public constructor(
    attempts: number,
    public readonly lastError: unknown,
  ) {
    super(`Unable to connect to Franken hardware after ${attempts} attempts`);
    this.name = 'FrankenConnectionFailedError';
  }
}

export class Franken {
  private static readonly responseDelayMs = 10;

  public constructor(
    private readonly socket: Socket,
    private readonly messageStream: MessageStream,
    private readonly sequentialQueue: SequentialQueue,
  ) {
  }

  static readonly separator = Buffer.from('\n\n');

  public async sendMessage(message: string) {
    logger.debug(`Sending message to sock | message: ${message}`);
    let responseBytes: Buffer;
    try {
      responseBytes = await this.sequentialQueue.exec(async () => {
        const requestBytes = Buffer.concat([Buffer.from(message), Franken.separator]);
        await this.write(requestBytes);
        const resp = await this.messageStream.readMessage(FRANKEN_RESPONSE_TIMEOUT_MS);

        if (Franken.responseDelayMs > 0) {
          await wait(10);
        }
        return resp;
      });
    } catch (error) {
      if (error instanceof MessageReadTimeoutError) {
        logger.warn(`Timed out waiting for Franken response. Closing stale socket. message: ${message}`);
        this.close();
      }
      throw error;
    }
    const response = responseBytes.toString();
    logger.debug(`Message sent successfully to sock | message: ${message}`);

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

  public async getDeviceStatus(getGestures=false): Promise<DeviceStatus> {
    const command: FrankenCommand = 'DEVICE_STATUS';
    const commandNumber = frankenCommands[command];
    const response = await this.sendMessage(commandNumber);
    return await loadDeviceStatus(response, getGestures);
  }

  public close() {
    const socket = this.socket;
    if (!socket.destroyed) socket.destroy();
  }

  public get isClosed() {
    return this.socket.destroyed;
  }

  public static fromSocket(socket: Socket) {
    const messageStream = new MessageStream(socket, Franken.separator);
    return new Franken(socket, messageStream, new SequentialQueue());
  }

  private async write(data: Buffer) {
    // @ts-expect-error
    await toPromise(cb => this.socket.write(data, cb));
  }
}

class FrankenServer {
  public constructor(private readonly server: UnixSocketServer) {
  }

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

function promiseWithTimeout<T>(promise: Promise<T>, onTimeout: () => Error) {
  let timeout: NodeJS.Timeout | undefined;
  return new Promise<T>((resolve, reject) => {
    timeout = setTimeout(() => {
      reject(onTimeout());
    }, FRANKEN_CONNECTION_TIMEOUT_MS);

    promise
      .then(value => {
        if (timeout) clearTimeout(timeout);
        resolve(value);
      })
      .catch(error => {
        if (timeout) clearTimeout(timeout);
        reject(error);
      });
  });
}


let frankenServer: FrankenServer | undefined;
let franken: Franken | undefined;
let connectPromise: Promise<Franken> | undefined;

function waitForFrankenWithTimeout(server: FrankenServer) {
  if (!FRANKEN_CONNECTION_TIMEOUT_MS) {
    return server.waitForFranken();
  }

  const timeoutMessage = `Restarting Franken after ${FRANKEN_CONNECTION_TIMEOUT_MS / 1_000}s timeout`;
  return promiseWithTimeout(server.waitForFranken(), () => {
    logger.warn(timeoutMessage);
    return new FrankenConnectionTimeoutError();
  });
}


async function shutdownFrankenServer() {
  franken?.close();
  franken = undefined;
  if (frankenServer) {
    await frankenServer.close();
    frankenServer = undefined;
  }
}

export async function connectFranken(): Promise<Franken> {
  if (franken) {
    if (!franken.isClosed) return franken;
    franken = undefined;
  }
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    for (let attempt = 1; attempt <= FRANKEN_CONNECTION_MAX_ATTEMPTS; attempt++) {
      if (!frankenServer) {
        frankenServer = await FrankenServer.start(config.dacSockPath);
        logger.debug('FrankenServer started');
      }

      try {
        logger.debug(`Waiting for Franken hardware connection... attempt ${attempt}/${FRANKEN_CONNECTION_MAX_ATTEMPTS}`);
        franken = await waitForFrankenWithTimeout(frankenServer);
        logger.info('Franken socket connected');
        return franken;
      } catch (error) {
        if (error instanceof FrankenConnectionTimeoutError) {
          await shutdownFrankenServer();
          if (attempt < FRANKEN_CONNECTION_MAX_ATTEMPTS) {
            logger.warn('Unable to connect to Franken within timeout, restarting socket server...');
            continue;
          }
          logger.error(`Unable to connect to Franken after ${FRANKEN_CONNECTION_MAX_ATTEMPTS} attempts`);
          throw new FrankenConnectionFailedError(FRANKEN_CONNECTION_MAX_ATTEMPTS, error);
        }
        await shutdownFrankenServer();
        throw error;
      }
    }
    throw new FrankenConnectionFailedError(FRANKEN_CONNECTION_MAX_ATTEMPTS, undefined);
  })();

  try {
    return await connectPromise;
  } finally {
    connectPromise = undefined;
  }
}

export async function disconnectFranken() {
  connectPromise = undefined;
  await shutdownFrankenServer();
}
