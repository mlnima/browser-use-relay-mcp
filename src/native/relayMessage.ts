import type WebSocket from "ws";
import type { RawData } from "ws";
import { NATIVE_HOST_NAME, RELAY_PROTOCOL_VERSION } from "../protocol/version.js";
import type { ActionRequest } from "../types/action.js";
import { MAX_CANCEL_REASON_LENGTH } from "../protocol/limits.js";
import { isActionRequest } from "./actionValidation.js";
import { sendRelayMessage } from "./relaySend.js";

type Session = { ready: boolean };
type RelayHandlers = {
  action: (socket: WebSocket, request: ActionRequest) => void;
  cancel: (socket: WebSocket, id: string, reason?: string) => void;
  ready: () => boolean;
};

const relayError = (socket: WebSocket, code: string, message: string) =>
  sendRelayMessage(socket, { type: "event", name: "relay.error", data: { code, message } });

export const handleRelayMessage = (
  socket: WebSocket,
  session: Session,
  data: RawData,
  binary: boolean,
  handlers: RelayHandlers,
) => {
  if (binary) {
    socket.close(1003, "Text JSON messages are required.");
    return;
  }
  let message: Record<string, unknown>;
  try {
    const text = Array.isArray(data)
      ? Buffer.concat(data).toString("utf8")
      : Buffer.from(data as ArrayBuffer).toString("utf8");
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    message = parsed as Record<string, unknown>;
  } catch {
    socket.close(1007, "Invalid JSON message.");
    return;
  }
  if (message.type === "ping" && typeof message.sentAt === "number") {
    sendRelayMessage(socket, { type: "pong", sentAt: message.sentAt });
    return;
  }
  if (message.type === "hello") {
    if (session.ready) {
      relayError(socket, "DUPLICATE_HELLO", "The relay handshake is already complete.");
      return;
    }
    if (message.client !== "mcp" || typeof message.name !== "string" ||
      message.protocolVersion !== RELAY_PROTOCOL_VERSION) {
      relayError(socket, "PROTOCOL_MISMATCH", `Relay protocol ${RELAY_PROTOCOL_VERSION} is required.`);
      socket.close(1002, "Protocol mismatch.");
      return;
    }
    if (!handlers.ready()) {
      relayError(socket, "RELAY_BUSY", "The relay already has an authenticated MCP client.");
      socket.close(1008, "The relay is in use.");
      return;
    }
    session.ready = true;
    sendRelayMessage(socket, {
      type: "event",
      name: "relay.ready",
      data: { protocolVersion: RELAY_PROTOCOL_VERSION, nativeHost: NATIVE_HOST_NAME },
    });
    return;
  }
  if (!session.ready) {
    socket.close(1002, "Send hello before relay requests.");
    return;
  }
  if (message.type === "action" && isActionRequest(message.request)) {
    handlers.action(socket, message.request);
    return;
  }
  if (message.type === "cancel" && typeof message.id === "string") {
    handlers.cancel(socket, message.id, typeof message.reason === "string" ? message.reason.slice(0, MAX_CANCEL_REASON_LENGTH) : undefined);
    return;
  }
  relayError(socket, "INVALID_RELAY_MESSAGE", "The relay message is not supported.");
};
