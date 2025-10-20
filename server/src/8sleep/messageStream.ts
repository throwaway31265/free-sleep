import type { PromiseReadStream } from './promiseStream.js';
import { withTimeout } from './promises.js';

export class MessageStream {
  private buffer = Buffer.alloc(0);

  public constructor(
    private readonly stream: PromiseReadStream<Buffer>,
    private readonly separator = Buffer.from('\n\n'),
  ) {}

  public async readMessage(timeoutMs = 5000) {
    return withTimeout(
      this.readMessageInternal(),
      timeoutMs,
      'Timeout reading message from frank.service',
    );
  }

  private async readMessageInternal() {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const index = this.buffer.indexOf(this.separator);
      if (index >= 0) {
        const message = this.buffer.slice(0, index);

        const messageLength = index + this.separator.length;
        this.buffer = this.buffer.slice(messageLength);
        return message;
      }

      await this.needMoreData();
    }
  }

  private async needMoreData() {
    const read = await this.stream.read();
    if (read === undefined) throw new Error('stream ended');
    this.buffer = Buffer.concat([this.buffer, read]);
  }
}
