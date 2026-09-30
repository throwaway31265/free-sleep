
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="0c1e81fa-3b2b-5897-bd67-8ac21ca60c64")}catch(e){}}();
import { once } from 'events';
import binarySplit from 'binary-split';
export class MessageReadTimeoutError extends Error {
    constructor(timeoutMs) {
        super(`Timed out waiting for Franken response after ${timeoutMs}ms`);
        this.name = 'MessageReadTimeoutError';
    }
}
export class MessageStream {
    splitter;
    queue = [];
    ended = false;
    error;
    constructor(readable, separator = Buffer.from('\n\n')) {
        this.splitter = binarySplit(separator);
        this.splitter.on('data', (chunk) => {
            this.queue.push(chunk);
        });
        this.splitter.on('end', () => {
            this.ended = true;
        });
        this.splitter.on('error', (err) => {
            this.error = err;
        });
        readable.pipe(this.splitter);
        readable.on('error', (error) => this.splitter.destroy(error));
    }
    async waitForData(timeoutMs) {
        if (!timeoutMs) {
            await once(this.splitter, 'data');
            return;
        }
        let timeout;
        try {
            await Promise.race([
                once(this.splitter, 'data'),
                new Promise((_resolve, reject) => {
                    timeout = setTimeout(() => reject(new MessageReadTimeoutError(timeoutMs)), timeoutMs);
                }),
            ]);
        }
        finally {
            if (timeout)
                clearTimeout(timeout);
        }
    }
    async readMessage(timeoutMs) {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            if (this.queue.length > 0) {
                return this.queue.shift();
            }
            if (this.error) {
                const err = this.error;
                this.error = undefined;
                throw err;
            }
            if (this.ended) {
                throw new Error('stream ended');
            }
            await this.waitForData(timeoutMs);
        }
    }
}
//# sourceMappingURL=messageStream.js.map
//# debugId=0c1e81fa-3b2b-5897-bd67-8ac21ca60c64
