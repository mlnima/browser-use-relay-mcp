import WebSocket from "ws";
import type { ActionRequest } from "../../types/action.js";
import type { RelayClient } from "../../types/mcp.js";
import { awaitSignal } from "./awaitSignal.js";
import { createPendingActions } from "./createPendingActions.js";
import { createRelayEventBuffer } from "./createRelayEventBuffer.js";
import { executeRelayAction } from "./executeRelayAction.js";
import { openRelaySocket, relayHandshakeCode } from "./openRelaySocket.js";
import { parseRelayInboundMessage } from "./parseRelayMessage.js";
const retryDelay = (milliseconds: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const finish = (error?: unknown) => (clearTimeout(timer), signal.removeEventListener("abort", abort), error ? reject(error) : resolve());
  const abort = () => finish(signal.reason instanceof Error ? signal.reason : new Error("Relay connection cancelled."));
  const timer = setTimeout(finish, milliseconds);
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
});
export const createRelayClient = (url: string, connectTimeoutMs: number, actionTimeoutMs: number): RelayClient => {
  let socket: WebSocket | undefined; let connecting: Promise<void> | undefined;
  let connectAbort: AbortController | undefined; let closing = false;
  const pending = createPendingActions();
  const eventBuffer = createRelayEventBuffer();
  const rejectProtocol = (source: WebSocket, message: string) => (pending.rejectSocket(source, message), source.close(1002, "Invalid relay message"));
  const receive = (data: WebSocket.RawData, source: WebSocket, binary: boolean) => {
    if (binary) return rejectProtocol(source, "Relay returned a binary protocol message.");
    let message;
    try {
      message = parseRelayInboundMessage(data);
    } catch {
      return rejectProtocol(source, "Relay returned malformed JSON.");
    }
    if (!message) return rejectProtocol(source, "Relay returned an invalid protocol message.");
    if (message.type === "result") pending.take(message.result.id)?.resolve(message.result);
    if (message.type === "event") eventBuffer.add(message);
    if (message.type === "event" && message.name === "relay.error") rejectProtocol(source, "Relay rejected a protocol message.");
    if (message.type === "ping" && source.readyState === WebSocket.OPEN) source.send(JSON.stringify({ type: "pong", sentAt: message.sentAt }));
  };
  const openWithRetry = async (signal: AbortSignal) => {
    const deadline = performance.now() + connectTimeoutMs;
    let backoffMs = 50;
    for (;;) {
      signal.throwIfAborted();
      const remainingMs = Math.floor(deadline - performance.now());
      if (remainingMs <= 0) throw new Error("Relay connection timed out.");
      try {
        return await openRelaySocket(url, remainingMs, signal, receive, (closed) => {
          if (socket === closed) socket = undefined;
          pending.rejectSocket(closed, "Relay connection closed.");
          eventBuffer.markDisconnected();
        });
      } catch (error) {
        const relayCode = relayHandshakeCode(error); signal.throwIfAborted();
        if (relayCode && relayCode !== "RELAY_BUSY") throw error;
        const retryWindowMs = Math.floor(deadline - performance.now());
        if (retryWindowMs <= 0) throw error;
        await retryDelay(Math.min(backoffMs, retryWindowMs), signal);
        backoffMs = Math.min(backoffMs * 2, 500);
      }
    }
  };
  const connectSocket = async () => {
    if (closing) throw new Error("Relay client is closed.");
    if (socket?.readyState === WebSocket.OPEN) return;
    if (connecting) return connecting;
    const controller = new AbortController(); connectAbort = controller;
    connecting = openWithRetry(controller.signal).then((opened) => {
      if (closing) return opened.terminate();
      socket = opened;
    }).finally(() => {
      if (connectAbort === controller) connectAbort = undefined;
      connecting = undefined;
    });
    return connecting;
  };
  const execute = async (request: ActionRequest, signal?: AbortSignal) => {
    signal?.throwIfAborted();
    await awaitSignal(connectSocket(), signal);
    signal?.throwIfAborted();
    const activeSocket = socket;
    if (activeSocket?.readyState !== WebSocket.OPEN) throw new Error("Relay connection is not open.");
    return executeRelayAction(activeSocket, pending, request, actionTimeoutMs, signal);
  };
  const close = async () => {
    closing = true;
    const opening = connecting;
    connectAbort?.abort(new Error("Relay client is closing."));
    await opening?.catch(() => undefined);
    const active = socket;
    socket = undefined;
    pending.rejectAll("Relay client closed.");
    if (!active || active.readyState === WebSocket.CLOSED) return;
    if (active.readyState === WebSocket.CONNECTING) return active.terminate();
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => active.terminate(), Math.min(connectTimeoutMs, 1_000));
      active.once("close", () => (clearTimeout(timer), resolve()));
      active.close();
    });
  };
  const connect = (signal?: AbortSignal) => (signal?.throwIfAborted(), awaitSignal(connectSocket(), signal));
  return { connect, execute, events: eventBuffer.read, close };
};
