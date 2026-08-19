export const awaitSignal = <Value>(promise: Promise<Value>, signal?: AbortSignal) => {
  if (!signal) return promise;
  signal.throwIfAborted();
  return new Promise<Value>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", aborted);
      callback();
    };
    const aborted = () => finish(() => reject(signal.reason instanceof Error ? signal.reason : new Error("Operation cancelled.")));
    signal.addEventListener("abort", aborted, { once: true });
    promise.then(
      (value) => finish(() => resolve(value)),
      (error: unknown) => finish(() => reject(error)),
    );
    if (signal.aborted) aborted();
  });
};
