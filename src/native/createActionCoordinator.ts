import type WebSocket from "ws";
import { getActionDefinition } from "../protocol/actionCatalog.js";
import type { ActionRequest, ActionResult } from "../types/action.js";
import type { NativeMessage } from "../types/relay.js";
import { failedActionResult } from "./actionResult.js";
import { createForwardedActions } from "./createForwardedActions.js";
import { createNativeRunner } from "./createNativeRunner.js";
import { canExecuteNativeAction } from "./executeNativeAction.js";
import { handleExtensionNativeAction } from "./handleExtensionNativeAction.js";
import { resetNativeDragState } from "./nativePointerDrag.js";
import { sendRelayMessage } from "./relaySend.js";
const extensionOwner = {};
export const createActionCoordinator = (write: (message: NativeMessage) => void) => {
  const runner = createNativeRunner();
  const forwarded = createForwardedActions(write, (id, reason, socket) => { void runner.cancelPrefix(id, reason, socket); });
  const busy = (socket: WebSocket, id: string) => runner.has(id, socket) || forwarded.has(id, socket);
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
    native
      ? runner.execute(request, socket, (result) => sendRelayMessage(socket, { type: "result", result }))
      : forwarded.forward(socket, request);
  };
  const onExtensionAction = (request: ActionRequest) =>
    handleExtensionNativeAction(write, request, runner, forwarded, extensionOwner);
  const onRelayCancel = async (socket: WebSocket, id: string, reason?: string) => {
    const message = reason || "The MCP client cancelled the action.";
    const relayed = forwarded.cancel(id, message, socket);
    if (!relayed && runner.has(id, socket)) await runner.cancel(id, message, socket);
  };
  const onSocketClose = async (socket: WebSocket, remainingClients: number) => {
    forwarded.cancelSocket(socket, "The MCP client disconnected.");
    await runner.disconnectOwner(socket, "The MCP client disconnected.");
    if (!remainingClients) await runner.releaseInput().then(resetNativeDragState);
  };
  const close = async () => {
    forwarded.close("The relay is stopping.");
    await runner.close();
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
    close,
  };
};
