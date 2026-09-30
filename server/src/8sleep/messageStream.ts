import { once } from 'events';
import binarySplit from 'binary-split';
import { Transform } from 'stream';

export class MessageReadTimeoutError extends Error {
  public constructor(timeoutMs: number) {
    super(`Timed out waiting for Franken response after ${timeoutMs}ms`);
    this.name = 'MessageReadTimeoutError';
  }
}

export class MessageStream {
  private readonly splitter: Transform;
  private readonly queue: Buffer[] = [];
  private ended = false;
  private error: unknown;

  public constructor(
    readable: NodeJS.ReadableStream,
    separator = Buffer.from('\n\n')
  ) {
    this.splitter = binarySplit(separator);
    this.splitter.on('data', (chunk: Buffer) => {
      this.queue.push(chunk);
    });
    this.splitter.on('end', () => {
      this.ended = true;
    });
    this.splitter.on('error', (err: unknown) => {
      this.error = err;
    });

    readable.pipe(this.splitter);
    readable.on('error', (error) => this.splitter.destroy(error));
  }

  private async waitForData(timeoutMs?: number) {
    if (!timeoutMs) {
      await once(this.splitter, 'data');
      return;
    }

    let timeout: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        once(this.splitter, 'data'),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => reject(new MessageReadTimeoutError(timeoutMs)), timeoutMs);
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  public async readMessage(timeoutMs?: number): Promise<Buffer> {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (this.queue.length > 0) {
        return this.queue.shift() as Buffer;
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
