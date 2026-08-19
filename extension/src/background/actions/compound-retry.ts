import { MAX_TIMER_MS } from "../../../../src/protocol/limits.js";
import type { ActionEngine, ActionRequest, ActionResult } from "../../../../src/types/action.js";
import type { JsonValue } from "../../../../src/types/json.js";

type Run = (request: ActionRequest, signal: AbortSignal) => Promise<ActionResult>;
const engines = new Set<ActionEngine>(["auto", "browser", "dom", "native"]);
const objectParam = (value: JsonValue | undefined) => value && typeof value === "object" && !Array.isArray(value)
  ? value as Record<string, JsonValue> : undefined;

export const executeRetryAction = async (request: ActionRequest, signal: AbortSignal, run: Run) => {
  const params = request.params || {};
  const action = String(params.action || "");
  if (!action || action === "retryAction") throw new Error("retryAction requires a non-recursive params.action.");
  const engine = String(params.engine || "auto") as ActionEngine;
  if (!engines.has(engine)) throw new Error("retryAction params.engine is invalid.");
  const retries = Number(params.retries ?? request.retries ?? 3);
  const retryDelayMs = Number(params.retryDelayMs ?? request.retryDelayMs ?? 200);
  if (!Number.isSafeInteger(retries) || retries < 0 || retries > 10) throw new Error("retryAction retries must be an integer from 0 to 10.");
  if (!Number.isSafeInteger(retryDelayMs) || retryDelayMs < 0 || retryDelayMs > MAX_TIMER_MS) throw new Error("retryAction retryDelayMs is invalid.");
  const result = await run({
    ...request,
    id: `${request.id}:retry`,
    action,
    engine,
    target: objectParam(params.target) as ActionRequest["target"] || request.target,
    params: objectParam(params.params),
    retries,
    retryDelayMs,
  }, signal);
  if (!result.success) throw new Error(result.error?.message || "Retried browser action failed.");
  return result as unknown as JsonValue;
};
