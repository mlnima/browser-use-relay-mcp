import type { ActionRequest } from "../types/action.js";
import { getActionDefinition } from "../protocol/actionCatalog.js";
import { MAX_TIMER_MS } from "../protocol/limits.js";
import { executeNativeAction } from "./executeNativeAction.js";
import { abortableDelay, throwIfAborted, type NativeError } from "./nativeError.js";

const isRetrySafe = (request: ActionRequest, error: unknown) =>
  getActionDefinition(request.action)?.readOnly === true ||
  (error as Partial<NativeError> | null)?.retryable === true;

export const executeNativeWithRetries = async (
  request: ActionRequest, signal: AbortSignal, owner: object,
) => {
  const requestedRetries = request.retries;
  const requestedDelay = request.retryDelayMs;
  const retries = typeof requestedRetries === "number" && Number.isSafeInteger(requestedRetries) && requestedRetries > 0
    ? requestedRetries : 0;
  const delayMs = typeof requestedDelay === "number" && Number.isSafeInteger(requestedDelay) && requestedDelay >= 0
    ? requestedDelay : 200;
  let failure: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    throwIfAborted(signal);
    try {
      return await executeNativeAction(request, signal, owner);
    } catch (error) {
      failure = error;
      throwIfAborted(signal);
      if (attempt >= retries || !isRetrySafe(request, error)) throw error;
      await abortableDelay(Math.min(delayMs * (attempt + 1), MAX_TIMER_MS), signal);
    }
  }
  throw failure;
};
