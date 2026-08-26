import WebSocket from "ws";
import { getActionDefinition } from "../../protocol/actionCatalog.js";
import { MAX_CANCEL_REASON_LENGTH, MAX_RELAY_CLIENT_BUFFER_BYTES, MAX_RELAY_REQUEST_BYTES } from "../../protocol/limits.js";
import type { ActionRequest, ActionResult } from "../../types/action.js";
import { jsonValueFitsLimits } from "../jsonValueLimits.js";
import type { PendingActions } from "./createPendingActions.js";

const failed = (request: ActionRequest, code: string, message: string, retryable: boolean): ActionResult => ({
  id: request.id,
  success: false,
  engine: request.engine && request.engine !== "auto" ? request.engine : getActionDefinition(request.action)?.engines[0] || "browser",
  error: { code, message, retryable },
  durationMs: 0,
});
const queueable = (socket: WebSocket, payload: string) => socket.bufferedAmount + Buffer.byteLength(payload) <= MAX_RELAY_CLIENT_BUFFER_BYTES;
const cancel = (socket: WebSocket, id: string, reason: string) => {
  if (socket.readyState !== WebSocket.OPEN) return;
  const payload = JSON.stringify({ type: "cancel", id, reason: reason.slice(0, MAX_CANCEL_REASON_LENGTH) });
  if (!queueable(socket, payload)) return socket.terminate();
  try { socket.send(payload, (error) => error && socket.terminate()); } catch { socket.terminate(); }
};

export const executeRelayAction = (socket: WebSocket, pending: PendingActions, request: ActionRequest, actionTimeoutMs: number, signal?: AbortSignal): Promise<ActionResult> => {
  if (pending.has(request.id)) return Promise.reject(new Error(`Relay action ID is already pending: ${request.id}`));
  if (request.params && !jsonValueFitsLimits(request.params)) return Promise.resolve(failed(request, "MCP_REQUEST_STRUCTURE_TOO_LARGE", "The action parameters exceeded the JSON structure limit.", false));
  const relayRequest = { ...request, timeoutMs: request.timeoutMs ?? actionTimeoutMs };
  const payload = JSON.stringify({ type: "action", request: relayRequest });
  if (Buffer.byteLength(payload) > MAX_RELAY_REQUEST_BYTES) return Promise.resolve(failed(request, "MCP_REQUEST_TOO_LARGE", "The relay action request exceeded the request size limit.", false));
  if (!queueable(socket, payload)) return Promise.resolve(failed(request, "MCP_RELAY_BACKPRESSURE", "The relay connection outbound queue is at capacity.", true));
  return new Promise<ActionResult>((resolve, reject) => {
    const timeoutMs = relayRequest.timeoutMs;
    const timer = setTimeout(() => {
      cancel(socket, request.id, `Action timed out after ${timeoutMs} ms.`);
      pending.take(request.id)?.reject(new Error(`Action timed out after ${timeoutMs} ms.`));
    }, timeoutMs);
    const onAbort = () => {
      cancel(socket, request.id, String(signal?.reason || "Cancelled"));
      pending.take(request.id)?.reject(signal?.reason instanceof Error ? signal.reason : new Error("Action cancelled."));
    };
    pending.add(request.id, { resolve, reject, timer, signal, onAbort, socket });
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) return onAbort();
    try { socket.send(payload, (error) => error && (pending.take(request.id)?.reject(error), socket.terminate())); }
    catch (error) { pending.take(request.id)?.reject(error instanceof Error ? error : new Error("Relay send failed.")); }
  });
};
