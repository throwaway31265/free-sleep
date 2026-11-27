import { once } from 'events';
import { unlink } from 'fs/promises';
import { createServer } from 'net';
import logger from '../logger.js';
export class UnixSocketServer {
    server;
    pendingConnections = [];
    waiting;
    constructor(server) {
        this.server = server;
        this.server.on('connection', (socket) => this.handleConnection(socket));
    }
    handleConnection(socket) {
        socket.on('error', (error) => logger.error({ error, message: 'Unix socket connection error' }));
        if (this.waiting) {
            const resolve = this.waiting;
            this.waiting = undefined;
            resolve(socket);
            return;
        }
        while (this.pendingConnections.length > 0) {
            const stale = this.pendingConnections.shift();
            stale?.destroy();
        }
        this.pendingConnections.push(socket);
    }
    async close() {
        this.waiting = undefined;
        this.pendingConnections.splice(0).forEach(socket => socket.destroy());
        this.server.close();
        await once(this.server, 'close');
    }
    async waitForConnection() {
        if (this.pendingConnections.length > 0) {
            const connection = this.pendingConnections.shift();
            return connection;
        }
        logger.debug('Waiting for future connection');
        return new Promise((resolve) => this.waiting = resolve);
    }
    static async start(path) {
        logger.debug('Creating socket connection...');
        await UnixSocketServer.tryCleanup(path);
        const unixSocketServer = createServer();
        unixSocketServer.on('error', (error) => logger.error({ error, message: 'Unix socket server error' }));
        await new Promise((resolve) => unixSocketServer.listen(path, resolve));
        const socket = new UnixSocketServer(unixSocketServer);
        logger.debug('Created socket connection!');
        return socket;
    }
    static async tryCleanup(path) {
        try {
            await unlink(path);
        }
        catch (err) {
            if (err?.code === 'ENOENT')
                return;
            throw err;
        }
    }
}
//# sourceMappingURL=unixSocketServer.js.map