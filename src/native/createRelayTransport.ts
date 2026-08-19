import type WebSocket from "ws";
import type { ActionRequest } from "../types/action.js";
import type { RelayMessage } from "../types/relay.js";
import { listenWebSocket } from "./listenWebSocket.js";
import { handleRelayMessage } from "./relayMessage.js";
import { broadcastRelayMessage } from "./relaySend.js";
import { MAX_PENDING_RELAY_HANDSHAKES, RELAY_HANDSHAKE_TIMEOUT_MS } from "./constants.js";
import { startRelayHeartbeat } from "./relayHeartbeat.js";

type TransportHandlers = {
  action: (socket: WebSocket, request: ActionRequest) => void;
  cancel: (socket: WebSocket, id: string, reason?: string) => void;
  disconnect: (socket: WebSocket, remainingClients: number) => void | Promise<void>;
  clients: (count: number) => void;
  error: (message: string, stopped?: boolean) => void;
};

export const createRelayTransport = (handlers: TransportHandlers) => {
  let listener: Awaited<ReturnType<typeof listenWebSocket>> | undefined;
  let admitting = false;
  const authenticated = new Set<WebSocket>();
  const pending = new Set<WebSocket>();
  const disconnects = new Set<Promise<void>>();
  let cleanupFailure: string | undefined;
  const failCleanup = (error: unknown) => {
    cleanupFailure = `Native input cleanup failed: ${error instanceof Error ? error.message : String(error)}`.slice(0, 4_096);
    handlers.error(cleanupFailure, true);
    const current = listener; listener = undefined; admitting = false;
    current?.server.clients.forEach((socket) => socket.terminate());
    current?.server.close();
    current?.httpServer.closeAllConnections();
    current?.httpServer.close();
  };

  const connect = (socket: WebSocket) => {
    if (!admitting || pending.size >= MAX_PENDING_RELAY_HANDSHAKES) {
      socket.terminate();
      return;
    }
    pending.add(socket);
    const session = { ready: false };
    let stopHeartbeat: () => void = () => undefined;
    const handshakeTimer = setTimeout(() => socket.close(1008, "Relay handshake timed out."), RELAY_HANDSHAKE_TIMEOUT_MS);
    socket.on("message", (data, binary) => handleRelayMessage(socket, session, data, binary, {
      action: (target, request) => admitting && handlers.action(target, request),
      cancel: handlers.cancel,
      ready: () => {
        pending.delete(socket);
        if (!admitting || authenticated.size || disconnects.size || cleanupFailure) return false;
        clearTimeout(handshakeTimer);
        authenticated.add(socket);
        stopHeartbeat = startRelayHeartbeat(socket);
        handlers.clients(authenticated.size);
        return true;
      },
    }));
    socket.once("close", () => {
      clearTimeout(handshakeTimer);
      stopHeartbeat();
      pending.delete(socket);
      const wasAuthenticated = authenticated.delete(socket);
      if (!wasAuthenticated) return;
      handlers.clients(authenticated.size);
      const remaining = authenticated.size;
      const task = Promise.resolve().then(() => handlers.disconnect(socket, remaining));
      disconnects.add(task);
      const remove = () => disconnects.delete(task);
      void task.then(remove, (error) => { remove(); failCleanup(error); });
    });
    socket.on("error", () => socket.terminate());
  };

  const start = async (host: string, port: number) => {
    if (cleanupFailure) throw new Error(cleanupFailure);
    listener = await listenWebSocket(host, port, connect);
    admitting = true;
    listener.server.on("error", (error) => handlers.error(error.message));
    listener.httpServer.on("error", (error) => handlers.error(error.message));
    return listener.port;
  };

  const stop = async () => {
    admitting = false;
    const current = listener;
    listener = undefined;
    pending.clear();
    if (!current) return;
    current.server.clients.forEach((socket) => socket.terminate());
    const webSocketClosed = new Promise<void>((resolve) => current.server.close(() => resolve()));
    const httpClosed = new Promise<void>((resolve) => current.httpServer.close(() => resolve()));
    current.httpServer.closeAllConnections();
    await Promise.all([webSocketClosed, httpClosed]);
    await Promise.allSettled([...disconnects]);
    authenticated.clear();
    handlers.clients(0);
  };

  const broadcast = (message: RelayMessage) => broadcastRelayMessage(authenticated, message);
  return { start, stop, broadcast, clientCount: () => authenticated.size };
};
