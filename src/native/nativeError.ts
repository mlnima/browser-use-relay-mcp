import type { ActionError } from "../types/action.js";
import type { JsonValue } from "../types/json.js";
import { boundedActionError } from "../protocol/actionError.js";
import { MAX_TIMER_MS } from "../protocol/limits.js";
import { isJsonValue } from "./jsonValueValidation.js";

export type NativeError = Error & { code: string; retryable: boolean; details?: JsonValue };

export const createNativeError = (
  code: string,
  message: string,
  retryable = false,
): NativeError => Object.assign(new Error(message), { code, retryable });

export const toActionError = (error: unknown): ActionError => {
  const value = error as Partial<NativeError>;
  let fallback = "Native action failed.";
  try { fallback = String(error); } catch {}
  return boundedActionError({
    code: typeof value.code === "string" ? value.code : "NATIVE_ACTION_FAILED",
    message: typeof value.message === "string" && value.message ? value.message : fallback,
    retryable: value.retryable === true,
    ...(value.details !== undefined && isJsonValue(value.details) ? { details: value.details } : {}),
  });
};

export const throwIfAborted = (signal: AbortSignal) => {
  if (!signal.aborted) return;
  throw signal.reason instanceof Error
    ? signal.reason
    : createNativeError("ACTION_CANCELLED", "The native action was cancelled.");
};

export const abortableDelay = (durationMs: number, signal: AbortSignal) => {
  if (!Number.isFinite(durationMs) || durationMs < 0 || durationMs > MAX_TIMER_MS)
    throw createNativeError("NATIVE_TIMER_LIMIT", `Native timer duration must be finite from 0 to ${MAX_TIMER_MS}.`);
  return new Promise<void>((resolve, reject) => {
    throwIfAborted(signal);
    const aborted = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", aborted);
      resolve();
    }, durationMs);
    signal.addEventListener("abort", aborted, { once: true });
  });
};
