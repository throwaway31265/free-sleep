/* eslint-disable @typescript-eslint/prefer-optional-chain */
// @ts-nocheck
// This was copied straight from the @eight/promise-streams package
// I was concerned they might remove the packages from npm if they want to prevent people from researching free-sleep
//
// So I made a copy of their packages here, so we don't depend on being able to install
// @eight/promises && @eight/promise-streams

import { Duplex, Readable, Writable } from 'stream';
import { toPromise } from './promises.js';

class StreamReader {
  constructor(stream, errorTransform) {
    this.stream = stream;
    this.errorTransform = errorTransform;
    this.eos = false;
    this.reader = true;
    if (!stream.readable) throw new Error('stream is not readable');
    stream.on('error', this.onError.bind(this));
    stream.on('end', this.onEnd.bind(this));
    stream.on('readable', this.onReadable.bind(this));
  }

  resolve(res) {
    if (this.promised !== undefined) {
      const [resolve] = this.promised;
      this.promised = undefined;
      resolve(res);
    }
  }

  onEnd() {
    this.eos = true;
    this.resolve(undefined);
  }

  onReadable() {
    if (this.promised !== undefined) {
      const read = this.stream.read();
      // tslint:disable-next-line:no-null-keyword
      if (read === null) {
        this.onEnd();
      } else {
        this.resolve(read);
      }
    }
  }

  onError(err) {
    this.eos = true;
    const error = this.errorTransform ? this.errorTransform(err) : err;
    if (this.promised !== undefined) {
      const [, reject] = this.promised;
      this.promised = undefined;
      reject(error);
    } else {
      this.error = error;
    }
  }

  read() {
    if (this.promised !== undefined)
      throw new Error('cannot invoke read concurrently (missing await ?)');
    if (this.error !== undefined) {
      const ret = Promise.reject(this.error);
      this.error = undefined;
      return ret;
    }
    if (this.eos) return Promise.resolve(undefined);
    const read = this.stream.read();
    // tslint:disable-next-line:no-null-keyword
    if (read !== null) return Promise.resolve(read);
    return new Promise((resolve, reject) => {
      this.promised = [resolve, reject];
    });
  }

  static isReader(obj) {
    return !!obj && !!obj.reader;
  }
}

function isReadable(stream) {
  return !!(stream && stream.readable);
}

function isWritable(stream) {
  return !!(stream && stream.writable);
}

class StreamWriter {
  constructor(stream, errorTransform) {
    this.stream = stream;
    this.errorTransform = errorTransform;
    this.reader = true;
    if (!stream.writable) throw new Error('stream is not writable');
  }

  async write(data) {
    try {
      await toPromise((cb) => this.stream.write(data, cb));
    } catch (err) {
      const error = this.errorTransform ? this.errorTransform(err) : err;
      this.stream.emit('error', error);
      throw error;
    }
  }

  static isWriter(obj) {
    return !!obj && !!obj.reader;
  }
}

class CombinedStream {
  constructor(readStream, writeStream) {
    this.readStream = readStream;
    this.writeStream = writeStream;
  }

  read() {
    return this.readStream.read();
  }

  write(chunk) {
    return this.writeStream.write(chunk);
  }
}

class ReadableWrapper extends Readable {
  constructor(stream) {
    super({ objectMode: true });
    this.stream = stream;
  }

  async _read() {
    try {
      let read;
      while ((read = (await this.stream.read()) && this.push(read)));
      if (!read) {
        // tslint:disable-next-line:no-null-keyword
        this.push(null);
      }
    } catch (error) {
      this.emit('error', error);
    }
  }
}

class WritableWrapper extends Writable {
  constructor(stream) {
    super({ objectMode: true });
    this.stream = stream;
  }

  async _write(chunk, enc, cb) {
    try {
      await this.stream.write(chunk);
    } catch (error) {
      cb(error);
    }
  }
}

class DuplexWrapper extends Duplex {
  constructor(stream) {
    super({ objectMode: true });
    this.readableStream = new ReadableWrapper(stream);
    this.writableStream = new WritableWrapper(stream);
  }

  _read() {
    this.readableStream._read();
  }

  _write(chunk, enc, cb) {
    this.writableStream._write(chunk, enc, cb);
  }
}

export interface PromiseWriteStream<T = any> {
  write(data: T): Promise<void>;
}

export interface PromiseReadStream<T = any> {
  read(): Promise<T | undefined>;
}

export declare type PromiseStream<T = any> = PromiseReadStream<T> &
  PromiseWriteStream<T>;

export class PromiseStreams {
  static toPromise(stream, errorTransform) {
    const reader = isReadable(stream)
      ? new StreamReader(stream, errorTransform)
      : undefined;
    const writer = isWritable(stream)
      ? new StreamWriter(stream, errorTransform)
      : undefined;
    if (!reader && !writer) throw new Error('not a stream');
    if (reader && writer) return new CombinedStream(reader, writer);
    return reader ? reader : writer;
  }

  static toStream(promiseStream) {
    const readable = !!promiseStream.read;
    const writable = !!promiseStream.write;
    if (readable && writable) return new DuplexWrapper(promiseStream);
    if (readable) return new ReadableWrapper(promiseStream);
    if (writable) return new WritableWrapper(promiseStream);
    throw new Error('not a promise-stream');
  }
}
