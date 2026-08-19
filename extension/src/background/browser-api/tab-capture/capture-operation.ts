export const captureOperationSignal = (signal: AbortSignal | undefined, timeoutMs: number) => {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
};

export const awaitCaptureOperation = <T>(pending: Promise<T>, signal: AbortSignal, label: string) => {
  let rejectAbort = (_error: Error): void => undefined;
  const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
  const abort = () => rejectAbort(new Error(`${label}: ${signal.reason instanceof Error
    ? signal.reason.message : "The capture operation was cancelled."}`));
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  return Promise.race([pending, aborted]).finally(() => signal.removeEventListener("abort", abort));
};
