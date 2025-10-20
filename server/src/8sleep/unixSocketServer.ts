import { unlink as unlinkCb } from 'fs';
import { createServer, type Server, type Socket } from 'net';
import logger from '../logger.js';
import { toPromise, withTimeout } from './promises.js';

async function unlink(path: string) {
  // @ts-ignore
  await toPromise((cb) => unlinkCb(path, cb));
}

export class UnixSocketServer {
  private lastConnection: Socket | undefined;
  private resolveWaiting: ((socket: Socket) => void) | undefined;

  public constructor(private readonly server: Server) {
    this.server.on('connection', this.onConnection.bind(this));
  }

  private cleanupExistingConnection() {
    const existingConnection = this.lastConnection;
    if (existingConnection !== undefined) {
      this.lastConnection = undefined;
      existingConnection.destroy();
    }
  }

  private onConnection(socket: Socket) {
    this.cleanupExistingConnection();

    if (this.resolveWaiting !== undefined) {
      logger.debug('Resolving connection waiting promise');

      const resolveWaiting = this.resolveWaiting;
      this.resolveWaiting = undefined;
      resolveWaiting(socket);
    } else {
      this.lastConnection = socket;
    }
  }

  public async close() {
    // @ts-ignore
    await toPromise((cb) => this.server.close(cb));
  }

  public waitForConnection(timeoutMs = 5000) {
    if (this.lastConnection !== undefined) {
      logger.debug('Returning existing connection');
      const connection = this.lastConnection;
      this.lastConnection = undefined;

      return Promise.resolve(connection);
    }

    logger.debug('Waiting for future connection');
    const connectionPromise = new Promise<Socket>(
      (resolve) => (this.resolveWaiting = resolve),
    );
    return withTimeout(
      connectionPromise,
      timeoutMs,
      'Timeout waiting for frank.service to connect to Unix socket',
    );
  }

  public static async start(path: string) {
    logger.debug('Creating socket connection...');
    await UnixSocketServer.tryCleanup(path);
    const unixSocketServer = createServer();
    unixSocketServer.on('error', (error) =>
      logger.error({ error: error, message: 'Unix socket server error' }),
    );

    await new Promise<void>((resolve) =>
      unixSocketServer.listen(path, resolve),
    );

    const socket = new UnixSocketServer(unixSocketServer);
    logger.debug('Created socket connection!');
    return socket;
  }

  private static async tryCleanup(path: string) {
    try {
      await unlink(path);
    } catch (err) {
      // ignore if the path doesn't exist
      if ((err as any)?.code === 'ENOENT') return;
      throw err;
    }
  }
}
