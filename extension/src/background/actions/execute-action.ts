import { getActionDefinition } from "../../../../src/protocol/actionCatalog.js";
import { MAX_TIMER_MS } from "../../../../src/protocol/limits.js";
import type { ActionEngine, ActionRequest, ActionResult } from "../../../../src/types/action.js";
import type { JsonValue } from "../../../../src/types/json.js";
import { executeBrowserApiAction } from "../browser-api/execute-browser-api-action";
import { executeCdpAction } from "../debugger/execute-cdp-action";
import { getState } from "../state/state-store";
import { executeContentAction } from "./content-transport";
import { executeCompoundAction } from "./compound-actions";
import { executeSnapshot } from "./snapshot";
import { executionError, isFallbackSafeError } from "./execution-error";

type EngineOutput = { data: JsonValue; revision?: number };
type NativeExecute = (request: ActionRequest, signal: AbortSignal) => Promise<ActionResult>;

const delay = (milliseconds: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const abort = () => (clearTimeout(timer), reject(signal.reason instanceof Error ? signal.reason : new Error("Action cancelled.")));
  const timer = setTimeout(() => (signal.removeEventListener("abort", abort), resolve()), milliseconds);
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
});

const executeDom = async (request: ActionRequest, signal: AbortSignal) => {
  if (request.action === "snapshot") return { data: await executeSnapshot(request, signal) };
  const result = await executeContentAction(request, signal);
  if (!result.success) throw executionError(result.error?.message || "Content action failed.", result.error?.code === "TARGET_RESOLUTION_FAILED");
  return { data: result.data ?? null, revision: result.revision };
};

const executeBrowser = async (request: ActionRequest, signal: AbortSignal) => {
  const apiResult = await executeBrowserApiAction(request, signal);
  const data = apiResult === undefined ? await executeCdpAction(request, signal) : apiResult;
  return data === undefined ? undefined : { data: data as JsonValue };
};

type Run = (request: ActionRequest, signal: AbortSignal) => Promise<ActionResult>;

const executeEngine = async (engine: Exclude<ActionEngine, "auto">, request: ActionRequest, signal: AbortSignal, run: Run, nativeExecute?: NativeExecute): Promise<EngineOutput | undefined> => {
  if (engine === "dom") return executeDom(request, signal);
  if (engine === "browser") {
    const compound = await executeCompoundAction(request, signal, run);
    return compound === undefined ? executeBrowser(request, signal) : { data: compound };
  }
  if (!nativeExecute) throw new Error("The browser-device native engine is unavailable.");
  const result = await nativeExecute({ ...request, engine: "native" }, signal);
  if (!result.success) throw new Error(result.error?.message || "Native action failed.");
  return { data: result.data ?? null, revision: result.revision };
};

export const executeActionRequest = async (request: ActionRequest, signal: AbortSignal, nativeExecute?: NativeExecute): Promise<ActionResult> => {
  const started = performance.now();
  const definition = getActionDefinition(request.action);
  const requested = request.engine || "auto";
  const hasWebTarget = Boolean(request.target && Object.values(request.target).some((value) => value !== undefined));
  const ambiguousPointerParams = definition?.category === "pointer" &&
    (request.params?.x !== undefined || request.params?.y !== undefined);
  const nativeOnly = definition?.engines.length === 1 && definition.engines[0] === "native";
  const engines = requested === "auto"
    ? definition?.engines.filter((engine) => engine !== "native" || nativeOnly || !hasWebTarget && !ambiguousPointerParams) || []
    : [requested];
  let lastError = new Error(`Unknown browser action: ${request.action}`);
  let lastEngine: Exclude<ActionEngine, "auto"> = "browser";
  const run = (nestedRequest: ActionRequest, nestedSignal: AbortSignal) => executeActionRequest(nestedRequest, nestedSignal, nativeExecute);
  const missingValue = ["fillField", "findAndFill"].includes(request.action) && !Object.prototype.hasOwnProperty.call(request.params || {}, "value");
  const unsupportedEngine = requested !== "auto" && !definition?.engines.some((engine) => engine === requested);
  if (!getState().settings.enabled) lastError = new Error("Browser control is disabled in the extension.");
  else if (missingValue) lastError = new Error("params.value is required.");
  else if (unsupportedEngine) lastError = new Error(`Action "${request.action}" does not support the ${requested} engine.`);
  else attempts: for (let attempt = 0; attempt <= (request.retries || 0); attempt += 1) {
    for (const engine of engines) {
      signal.throwIfAborted();
      lastEngine = engine;
      try {
        const output = await executeEngine(engine, request, signal, run, nativeExecute);
        if (output) return { id: request.id, success: true, engine, ...output, durationMs: performance.now() - started };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Action execution failed.");
        if (!definition?.readOnly && !isFallbackSafeError(error)) break attempts;
      }
    }
    if (attempt < (request.retries || 0)) await delay(Math.min((request.retryDelayMs ?? 200) * (attempt + 1), MAX_TIMER_MS), signal);
  }
  const retryable = /stale|missing|timeout|closed|navigation|detached|temporar/i.test(lastError.message);
  return {
    id: request.id,
    success: false,
    engine: lastEngine,
    error: { code: retryable ? "RETRYABLE_ACTION_FAILURE" : "ACTION_FAILURE", message: lastError.message, retryable },
    durationMs: performance.now() - started,
  };
};
