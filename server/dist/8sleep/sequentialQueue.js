
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="f5aec054-ac8b-523c-a21c-52b0abd7ec78")}catch(e){}}();
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
//# debugId=f5aec054-ac8b-523c-a21c-52b0abd7ec78
