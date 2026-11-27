export class SequentialQueue {
    executing = Promise.resolve();
    execInternal(f) {
        const current = this.executing;
        // eslint-disable-next-line no-async-promise-executor
        const newPromise = new Promise(async (resolve) => {
            await current;
            await f();
            resolve();
        });
        this.executing = newPromise;
        return newPromise;
    }
    exec(f) {
        return new Promise((resolve, reject) => {
            this.execInternal(async () => {
                try {
                    resolve(await f());
                }
                catch (err) {
                    reject(err);
                }
            });
        });
    }
}
//# sourceMappingURL=sequentialQueue.js.map