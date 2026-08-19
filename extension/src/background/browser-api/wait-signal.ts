export const abortReason = (signal?: AbortSignal) => signal?.reason instanceof Error
  ? signal.reason
  : new Error(signal?.reason ? String(signal.reason) : "Action cancelled.");

export const listenForAbort = (signal: AbortSignal | undefined, listener: () => void) => {
  if (!signal) return () => undefined;
  if (signal.aborted) {
    listener();
    return () => undefined;
  }
  signal.addEventListener("abort", listener, { once: true });
  return () => signal.removeEventListener("abort", listener);
};
