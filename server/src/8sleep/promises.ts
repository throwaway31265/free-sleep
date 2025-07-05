// @ts-nocheck
// This was copied straight from the @eight/promises packages
// I was concerned they might remove the packages from npm if they want to prevent people from researching free-sleep
//
// So I made a copy of their packages here, so we don't depend on being able to install
// @eight/promises && @eight/promise-streams

export function toPromise(func) {
  return new Promise((resolve, reject) => {
    func((err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

export function wait(milliseconds) {
  let timer;
  let resolve;
  const ret = new Promise((res) => {
    timer = setTimeout(res, milliseconds);
    resolve = res;
  });
  ret.cancel = () => {
    clearTimeout(timer);
    resolve();
  };
  return ret;
}
