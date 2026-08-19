import {
  MAX_INPUT_ACTION_STEPS, MAX_INPUT_SEQUENCE_DURATION_MS, MAX_INPUT_TEXT_CHARACTERS,
} from "../protocol/limits.js";
import { NATIVE_INPUT_YIELD_INTERVAL } from "./constants.js";
import { abortableDelay, createNativeError, throwIfAborted } from "./nativeError.js";

export const nativeInputNumber = (value: unknown, fallback: number, label: string) => {
  const resolved = value ?? fallback;
  if (typeof resolved !== "number" || !Number.isFinite(resolved))
    throw createNativeError("INVALID_NATIVE_PARAMETERS", `${label} must be a finite number.`);
  return resolved;
};
export const nativeInputCount = (value: unknown, fallback: number, label: string, minimum = 1) => {
  const resolved = value ?? fallback;
  if (typeof resolved !== "number" || !Number.isSafeInteger(resolved) ||
    resolved < minimum || resolved > MAX_INPUT_ACTION_STEPS)
    throw createNativeError("NATIVE_ITERATION_LIMIT", `${label} must be a safe integer from ${minimum} to ${MAX_INPUT_ACTION_STEPS}.`);
  return resolved;
};
export const nativeInputDuration = (value: unknown, fallback: number, label: string) => {
  const resolved = nativeInputNumber(value, fallback, label);
  if (resolved < 0 || resolved > MAX_INPUT_SEQUENCE_DURATION_MS)
    throw createNativeError("NATIVE_DURATION_LIMIT", `${label} must be a finite number from 0 to ${MAX_INPUT_SEQUENCE_DURATION_MS}.`);
  return resolved;
};
export const assertNativeInputDuration = (value: number, label: string) => {
  if (!Number.isFinite(value) || value < 0 || value > MAX_INPUT_SEQUENCE_DURATION_MS)
    throw createNativeError("NATIVE_DURATION_LIMIT", `${label} exceeds the ${MAX_INPUT_SEQUENCE_DURATION_MS}-millisecond action limit.`);
};
export const assertNativeText = (value: string, maximum = MAX_INPUT_TEXT_CHARACTERS) => {
  if (value.length > maximum)
    throw createNativeError("NATIVE_TEXT_LIMIT", `Native text cannot exceed ${maximum} characters.`);
};
export const nativeTypingPlan = (value: string, intervalMs: number, maximum = MAX_INPUT_TEXT_CHARACTERS) => {
  assertNativeText(value, maximum);
  const interval = nativeInputDuration(intervalMs, intervalMs, "Typing intervalMs");
  const durationMs = Math.max(0, Array.from(value).length - 1) * interval;
  assertNativeInputDuration(durationMs, "Native typing duration");
  return { durationMs, intervalMs: interval };
};
export const yieldNativeInput = async (index: number, signal: AbortSignal) => {
  throwIfAborted(signal);
  if (index > 0 && index % NATIVE_INPUT_YIELD_INTERVAL === 0) await abortableDelay(0, signal);
};
