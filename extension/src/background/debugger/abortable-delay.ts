import { MAX_INPUT_ACTION_STEPS, MAX_INPUT_SEQUENCE_DURATION_MS } from "../../../../src/protocol/limits.js";

export const inputCount = (value: unknown, fallback: number, label: string, minimum = 1) => {
  const resolved = value ?? fallback;
  if (typeof resolved !== "number" || !Number.isSafeInteger(resolved) || resolved < minimum || resolved > MAX_INPUT_ACTION_STEPS) {
    throw new Error(`${label} must be a safe integer from ${minimum} to ${MAX_INPUT_ACTION_STEPS}.`);
  }
  return resolved;
};
export const inputDuration = (value: unknown, fallback: number, label: string) => {
  const resolved = value ?? fallback;
  if (typeof resolved !== "number" || !Number.isFinite(resolved) || resolved < 0 || resolved > MAX_INPUT_SEQUENCE_DURATION_MS) {
    throw new Error(`${label} must be a finite number from 0 to ${MAX_INPUT_SEQUENCE_DURATION_MS}.`);
  }
  return resolved;
};
export const inputNumber = (value: unknown, fallback: number, label: string) => {
  const resolved = value ?? fallback;
  if (typeof resolved !== "number" || !Number.isFinite(resolved)) throw new Error(`${label} must be a finite number.`);
  return resolved;
};
export const assertInputDuration = (milliseconds: number, label: string) => {
  if (!Number.isFinite(milliseconds) || milliseconds > MAX_INPUT_SEQUENCE_DURATION_MS) throw new Error(`${label} exceeds the ${MAX_INPUT_SEQUENCE_DURATION_MS}-millisecond action limit.`);
};
export const abortableDelay = (milliseconds: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  inputDuration(milliseconds, 0, "delay");
  const complete = () => {
    signal?.removeEventListener("abort", abort);
    resolve();
  };
  const abort = () => {
    signal?.removeEventListener("abort", abort);
    clearTimeout(timer);
    reject(signal?.reason instanceof Error ? signal.reason : new Error("Input action cancelled."));
  };
  const timer = setTimeout(complete, milliseconds);
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
});
