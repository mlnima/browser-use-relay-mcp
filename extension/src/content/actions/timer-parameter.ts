import { MAX_TIMER_MS } from "../../../../src/protocol/limits.js";

export const timerParameter = (value: unknown, fallback: number, minimum: number) => {
  const resolved = value === undefined ? fallback : value;
  if (typeof resolved !== "number" || !Number.isSafeInteger(resolved) || resolved < minimum || resolved > MAX_TIMER_MS) {
    throw new Error(`Timer value must be an integer from ${minimum} to ${MAX_TIMER_MS}.`);
  }
  return resolved;
};
