import { SequentialQueue } from './sequentialQueue.js';
import { MessageReadTimeoutError, MessageStream } from './messageStream.js';
import { frankenCommands } from './deviceApi.js';
import { UnixSocketServer } from './unixSocketServer.js';
import logger from '../logger.js';
import { loadDeviceStatus } from './loadDeviceStatus.js';
import config from '../config.js';
import { toPromise, wait } from './promises.js';
const FRANKEN_CONNECTION_TIMEOUT_MS = 25_000;
const FRANKEN_CONNECTION_MAX_ATTEMPTS = 10;
const FRANKEN_RESPONSE_TIMEOUT_MS = 10_000;
class FrankenConnectionTimeoutError extends Error {
    constructor() {
        super('Timed out waiting for Franken hardware connection');
        this.name = 'FrankenConnectionTimeoutError';
    }
}
class FrankenConnectionFailedError extends Error {
    lastError;
    constructor(attempts, lastError) {
        super(`Unable to connect to Franken hardware after ${attempts} attempts`);
        this.lastError = lastError;
        this.name = 'FrankenConnectionFailedError';
    }
}
export class Franken {
    socket;
    messageStream;
    sequentialQueue;
    static responseDelayMs = 10;
    constructor(socket, messageStream, sequentialQueue) {
        this.socket = socket;
        this.messageStream = messageStream;
        this.sequentialQueue = sequentialQueue;
    }
    static separator = Buffer.from('\n\n');
    async sendMessage(message) {
        logger.debug(`Sending message to sock | message: ${message}`);
        let responseBytes;
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
        }
        catch (error) {
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
    tryStripNewlines(arg) {
        const containsNewline = arg.indexOf('\n') >= 0;
        if (!containsNewline)
            return arg;
        return arg.replace(/\n/gm, '');
    }
    async callFunction(command, arg) {
        logger.debug(`Calling function | command: ${command} | arg: ${arg}`);
        const commandNumber = frankenCommands[command];
        const cleanedArg = this.tryStripNewlines(arg);
        logger.debug(`commandNumber: ${commandNumber}`);
        logger.debug(`cleanedArg: ${cleanedArg}`);
        await this.sendMessage(`${commandNumber}\n${cleanedArg}`);
    }
    async getDeviceStatus(getGestures = false) {
        const command = 'DEVICE_STATUS';
        const commandNumber = frankenCommands[command];
        const response = await this.sendMessage(commandNumber);
        return await loadDeviceStatus(response, getGestures);
    }
    close() {
        const socket = this.socket;
        if (!socket.destroyed)
            socket.destroy();
    }
    get isClosed() {
        return this.socket.destroyed;
    }
    static fromSocket(socket) {
        const messageStream = new MessageStream(socket, Franken.separator);
        return new Franken(socket, messageStream, new SequentialQueue());
    }
    async write(data) {
        // @ts-expect-error
        await toPromise(cb => this.socket.write(data, cb));
    }
}
class FrankenServer {
    server;
    constructor(server) {
        this.server = server;
    }
    async close() {
        logger.debug('Closing FrankenServer socket...');
        await this.server.close();
    }
    async waitForFranken() {
        const socket = await this.server.waitForConnection();
        logger.debug('FrankenServer connected');
        return Franken.fromSocket(socket);
    }
    static async start(path) {
        logger.debug(`Creating franken server on socket: ${config.dacSockPath}`);
        const unixSocketServer = await UnixSocketServer.start(path);
        return new FrankenServer(unixSocketServer);
    }
}
function promiseWithTimeout(promise, onTimeout) {
    let timeout;
    return new Promise((resolve, reject) => {
        timeout = setTimeout(() => {
            reject(onTimeout());
        }, FRANKEN_CONNECTION_TIMEOUT_MS);
        promise
            .then(value => {
            if (timeout)
                clearTimeout(timeout);
            resolve(value);
        })
            .catch(error => {
            if (timeout)
                clearTimeout(timeout);
            reject(error);
        });
    });
}
let frankenServer;
let franken;
let connectPromise;
function waitForFrankenWithTimeout(server) {
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
export async function connectFranken() {
    if (franken) {
        if (!franken.isClosed)
            return franken;
        franken = undefined;
    }
    if (connectPromise)
        return connectPromise;
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
            }
            catch (error) {
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
    }
    finally {
        connectPromise = undefined;
    }
}
export async function disconnectFranken() {
    connectPromise = undefined;
    await shutdownFrankenServer();
}
//# sourceMappingURL=frankenServer.js.map