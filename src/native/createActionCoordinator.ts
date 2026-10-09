import type WebSocket from "ws";
import { getActionDefinition, resolveInputAction } from "../protocol/actionCatalog.js";
import type { ActionRequest, ActionResult, NativePage } from "../types/action.js";
import type { NativeMessage } from "../types/relay.js";
import type { ActionDelaySettings, InputEngineSettings } from "../types/settings.js";
import { failedActionResult } from "./actionResult.js";
import { DEFAULT_ACTION_TIMEOUT_MS } from "./constants.js";
import { createForwardedActions } from "./createForwardedActions.js";
import { createNativeRunner } from "./createNativeRunner.js";
import { canExecuteNativeAction } from "./executeNativeAction.js";
import { handleExtensionNativeAction } from "./handleExtensionNativeAction.js";
import { resetNativeDragState } from "./nativePointerDrag.js";
import { abortableDelay, createNativeError } from "./nativeError.js";
import { isDownloadTransferRequest } from "./nativeDownloadTransfer.js";
import { isUploadTransferRequest } from "./nativeUploadTransfer.js";
import { sendRelayMessage } from "./relaySend.js";
import { nativePageActions } from "./nativeActionNames.js";
const extensionOwner = {};
export const createActionCoordinator = (write: (message: NativeMessage) => void, getDelaySettings: () => ActionDelaySettings & InputEngineSettings) => {
  const runner = createNativeRunner();
  let lastActionAt = -Infinity;
  let dispatchQueue = Promise.resolve();
  const waiting = new Map<WebSocket, Map<string, (code: string, message: string, retryable?: boolean) => void>>();
  const completed = () => { lastActionAt = performance.now(); };
  const forwarded = createForwardedActions(write, (id, reason, socket) => { void runner.cancelPrefix(id, reason, socket); }, completed);
  const busy = (socket: WebSocket, id: string) => waiting.get(socket)?.has(id) || runner.has(id, socket) || forwarded.has(id, socket);
  const validate = (request: ActionRequest) => {
    const definition = getActionDefinition(request.action);
    if (!definition) return `Unknown action "${request.action}".`;
    if (request.engine && request.engine !== "auto" && !definition.engines.some((engine) => engine === request.engine))
      return `Action "${request.action}" does not support the ${request.engine} engine.`;
    return undefined;
  };
  const sendFailure = (socket: WebSocket, request: ActionRequest, code: string, message: string, retryable = false) =>
    sendRelayMessage(socket, { type: "result", result: failedActionResult(request, code, message, 0, retryable) });
  const waitToDispatch = (request: ActionRequest, signal: AbortSignal, dispatch: () => boolean = () => true) => {
    const operation = dispatchQueue.then(async () => {
      signal.throwIfAborted();
      const settings = request.actionDelayMinMs !== undefined || request.actionDelayMaxMs !== undefined ? request : getDelaySettings();
      const minimum = settings.actionDelayMinMs ?? settings.actionDelayMaxMs ?? 0;
      const maximum = settings.actionDelayMaxMs ?? minimum;
      const interval = minimum + Math.random() * (maximum - minimum);
      for (let remaining = lastActionAt + interval - performance.now(); remaining > 0; remaining = lastActionAt + interval - performance.now())
        await abortableDelay(remaining, signal);
      signal.throwIfAborted();
      resolveInputAction(request, getDelaySettings().inputEngine);
      if (!dispatch()) return false;
      lastActionAt = performance.now();
      return true;
    });
    dispatchQueue = operation.then(() => undefined, () => undefined);
    return operation;
  };
  const queueAction = (socket: WebSocket, request: ActionRequest) => {
    const controller = new AbortController();
    const startedAt = performance.now();
    const timeoutMs = request.timeoutMs ?? DEFAULT_ACTION_TIMEOUT_MS;
    const pending = waiting.get(socket) || new Map();
    waiting.set(socket, pending);
    let dispatched = false;
    const remove = () => {
      clearTimeout(timer);
      pending.delete(request.id);
      if (!pending.size) waiting.delete(socket);
    };
    const cancel = (code: string, message: string, retryable = false) => {
      if (dispatched || controller.signal.aborted) return;
      controller.abort(createNativeError(code, message, retryable));
      remove();
      sendFailure(socket, request, code, message, retryable);
    };
    const timer = setTimeout(() => cancel("ACTION_TIMEOUT", `Action timed out after ${timeoutMs} ms.`, true), timeoutMs);
    pending.set(request.id, cancel);
    void waitToDispatch(request, controller.signal).then(() => {
      controller.signal.throwIfAborted();
      remove();
      const next = { ...request, timeoutMs: Math.max(1, Math.floor(timeoutMs - (performance.now() - startedAt))) };
      forwarded.forward(socket, next);
      dispatched = true;
    }).catch((error: unknown) => cancel("ACTION_FAILURE", error instanceof Error ? error.message : "Action dispatch failed."));
  };
  const onRelayAction = (socket: WebSocket, request: ActionRequest) => {
    try {
      request = resolveInputAction(request, getDelaySettings().inputEngine);
    } catch (error) {
      sendFailure(socket, request, "INPUT_ENGINE_RESTRICTED", error instanceof Error ? error.message : "The input engine is restricted.");
      return;
    }
    if (busy(socket, request.id)) {
      sendFailure(socket, request, "DUPLICATE_ACTION_ID", `Action id "${request.id}" is already active.`);
      return;
    }
    const error = validate(request);
    if (error) {
      sendFailure(socket, request, "INVALID_ACTION", error);
      return;
    }
    const definition = getActionDefinition(request.action);
    const native = request.engine === "native" || (
      (!request.engine || request.engine === "auto") && definition?.engines.length === 1 && definition.engines[0] === "native"
    );
    if (native && !canExecuteNativeAction(request)) {
      sendFailure(socket, request, "NATIVE_ACTION_UNAVAILABLE", `Native action "${request.action}" is not implemented by the OS host.`);
      return;
    }
    if (native && !nativePageActions.has(request.action)) {
      const transfer = isUploadTransferRequest(request) || isDownloadTransferRequest(request);
      let dispatched = false;
      runner.execute(request, socket, (result) => {
        dispatched && completed();
        sendRelayMessage(socket, { type: "result", result });
      }, transfer ? undefined : (signal, dispatch) => waitToDispatch(request, signal, () => dispatched = dispatch()));
    } else queueAction(socket, request);
  };
  const onExtensionAction = (request: ActionRequest, page?: NativePage) =>
    handleExtensionNativeAction(write, request, runner, forwarded, extensionOwner, getDelaySettings().inputEngine, page);
  const onRelayCancel = async (socket: WebSocket, id: string, reason?: string) => {
    const message = reason || "The MCP client cancelled the action.";
    waiting.get(socket)?.get(id)?.("ACTION_CANCELLED", message);
    const relayed = forwarded.cancel(id, message, socket);
    if (!relayed && runner.has(id, socket)) await runner.cancel(id, message, socket);
  };
  const onSocketClose = async (socket: WebSocket, remainingClients: number) => {
    for (const cancel of waiting.get(socket)?.values() || []) cancel("ACTION_CANCELLED", "The MCP client disconnected.");
    forwarded.cancelSocket(socket, "The MCP client disconnected.");
    await runner.disconnectOwner(socket, "The MCP client disconnected.");
    if (!remainingClients) await runner.releaseInput().then(resetNativeDragState);
  };
  const close = async () => {
    for (const pending of waiting.values()) for (const cancel of pending.values()) cancel("ACTION_CANCELLED", "The relay is stopping.");
    forwarded.close("The relay is stopping.");
    await runner.close();
    await dispatchQueue;
  };
  const onExtensionCancel = (id: string, reason?: string) => runner.cancel(
    id,
    reason || "The extension cancelled the action.",
    forwarded.ownerForExtensionAction(id) || extensionOwner,
  );
  return {
    onRelayAction,
    onRelayCancel,
    onSocketClose,
    onExtensionAction,
    onExtensionResult: (result: ActionResult) => forwarded.complete(result.id, result),
    onExtensionCancel,
    invalidatePage: runner.invalidatePage,
    releaseInput: () => runner.releaseInput().then(resetNativeDragState),
    close,
  };
};
