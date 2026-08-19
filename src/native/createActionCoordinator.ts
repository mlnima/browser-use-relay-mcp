import type WebSocket from "ws";
import { getActionDefinition } from "../protocol/actionCatalog.js";
import { MAX_ACTIVE_ACTIONS, MAX_ACTIVE_ACTIONS_PER_OWNER } from "./constants.js";
import type { ActionRequest, ActionResult } from "../types/action.js";
import type { NativeMessage } from "../types/relay.js";
import { failedActionResult } from "./actionResult.js";
import { createForwardedActions } from "./createForwardedActions.js";
import { createNativeRunner } from "./createNativeRunner.js";
import { canExecuteNativeAction } from "./executeNativeAction.js";
import { handleExtensionNativeAction } from "./handleExtensionNativeAction.js";
import { releaseAllNativeInput } from "./nativeInputState.js";
import { resetNativeDragState } from "./nativePointerDrag.js";
import { sendRelayMessage } from "./relaySend.js";
const extensionOwner = {};
export const createActionCoordinator = (write: (message: NativeMessage) => void) => {
  const runner = createNativeRunner();
  const forwarded = createForwardedActions(write, (id, reason, socket) => { void runner.cancelPrefix(id, reason, socket); });
  const busy = (id: string) => runner.has(id) || forwarded.has(id);
  const queueBusy = (owner: object) => runner.count() + forwarded.count() >= MAX_ACTIVE_ACTIONS || runner.countOwner(owner) + forwarded.countOwner(owner) >= MAX_ACTIVE_ACTIONS_PER_OWNER;
  const validate = (request: ActionRequest) => {
    const definition = getActionDefinition(request.action);
    if (!definition) return `Unknown action "${request.action}".`;
    if (request.engine && request.engine !== "auto" && !definition.engines.some((engine) => engine === request.engine))
      return `Action "${request.action}" does not support the ${request.engine} engine.`;
    return undefined;
  };
  const sendFailure = (socket: WebSocket, request: ActionRequest, code: string, message: string, retryable = false) =>
    sendRelayMessage(socket, { type: "result", result: failedActionResult(request, code, message, 0, retryable) });
  const onRelayAction = (socket: WebSocket, request: ActionRequest) => {
    if (busy(request.id)) {
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
    if (queueBusy(socket)) {
      sendFailure(socket, request, "ACTION_QUEUE_BUSY", "The native relay action queue is at capacity.", true);
      return;
    }
    native
      ? runner.execute(request, socket, (result) => sendRelayMessage(socket, { type: "result", result }))
      : forwarded.forward(socket, request);
  };
  const onExtensionAction = (request: ActionRequest) =>
    handleExtensionNativeAction(write, request, runner, forwarded, extensionOwner);
  const onRelayCancel = async (socket: WebSocket, id: string, reason?: string) => {
    const message = reason || "The MCP client cancelled the action.";
    const relayed = forwarded.cancel(id, message, socket);
    if (!relayed && runner.has(id)) await runner.cancel(id, message, socket);
  };
  const onSocketClose = async (socket: WebSocket) => {
    forwarded.cancelSocket(socket, "The MCP client disconnected.");
    await runner.cancelOwner(socket, "The MCP client disconnected.");
    await releaseAllNativeInput().then(resetNativeDragState);
  };
  const close = async () => {
    forwarded.close("The relay is stopping.");
    await runner.close();
  };
  return {
    onRelayAction,
    onRelayCancel,
    onSocketClose,
    onExtensionAction,
    onExtensionResult: (result: ActionResult) => forwarded.complete(result.id, result),
    onExtensionCancel: (id: string, reason?: string) => runner.cancel(id, reason || "The extension cancelled the action."),
    close,
  };
};
