import type WebSocket from "ws";
import type { ActionRequest, ActionResult } from "../types/action.js";
import type { NativeMessage } from "../types/relay.js";
import { DEFAULT_ACTION_TIMEOUT_MS, MAX_NATIVE_OUTPUT_BYTES } from "./constants.js";
import { failedActionResult } from "./actionResult.js";
import { createForwardedActionRegistry } from "./forwardedActionRegistry.js";
import { sendRelayMessage } from "./relaySend.js";

export const createForwardedActions = (
  write: (message: NativeMessage) => void,
  cancelNative: (id: string, reason: string, socket: WebSocket) => void,
) => {
  const registry = createForwardedActionRegistry();
  const complete = (extensionId: string, result: ActionResult) => {
    const action = registry.takeResult(extensionId);
    if (!action) return false;
    clearTimeout(action.timer);
    sendRelayMessage(action.socket, { type: "result", result: { ...result, id: action.request.id } });
    return true;
  };
  const cancel = (id: string, reason: string, socket?: WebSocket) => {
    const current = registry.takePublic(id, socket);
    if (!current) return false;
    const { extensionId, action } = current;
    write({ type: "cancel", id: extensionId, reason });
    cancelNative(extensionId, reason, action.socket);
    clearTimeout(action.timer);
    sendRelayMessage(action.socket, { type: "result", result: failedActionResult(
      action.request, "ACTION_CANCELLED", reason,
      Math.round(performance.now() - action.startedAt),
    ) });
    return extensionId;
  };
  const forward = (socket: WebSocket, request: ActionRequest) => {
    const startedAt = performance.now();
    let extensionId = "";
    const timeoutMs = request.timeoutMs ?? DEFAULT_ACTION_TIMEOUT_MS;
    const timer = setTimeout(() => {
      const current = registry.takePublic(request.id, socket, extensionId);
      if (!current) return;
      write({ type: "cancel", id: extensionId, reason: "Action timed out in the relay." });
      cancelNative(extensionId, "Action timed out in the relay.", socket);
      sendRelayMessage(socket, { type: "result", result: failedActionResult(
        request, "ACTION_TIMEOUT", `Action timed out after ${timeoutMs} ms.`,
        Math.round(performance.now() - startedAt), true,
      ) });
    }, timeoutMs);
    extensionId = registry.add({ request, socket, timer, startedAt });
    const message = { type: "actionRequest", request: { ...request, id: extensionId } } as const;
    if (Buffer.byteLength(JSON.stringify(message)) <= MAX_NATIVE_OUTPUT_BYTES) {
      write(message);
      return;
    }
    clearTimeout(timer);
    registry.takePublic(request.id, socket);
    sendRelayMessage(socket, { type: "result", result: failedActionResult(
      request, "NATIVE_MESSAGE_TOO_LARGE", "The action request exceeded the browser native-messaging limit.",
    ) });
  };
  const cancelSocket = (socket: WebSocket, reason: string) => registry.publicIdsFor(socket)
    .flatMap((id) => cancel(id, reason, socket) || []);
  const close = (reason: string) => {
    for (const id of registry.activePublicIds()) cancel(id, reason);
  };
  return {
    forward, complete, cancel, cancelSocket, close,
    has: registry.has, count: registry.count, countOwner: registry.countOwner,
    ownerForExtensionAction: registry.ownerForExtensionAction,
    isForwardedExtensionAction: registry.isForwardedExtensionAction,
  };
};
