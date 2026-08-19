import WebSocket from "ws";
import type { RelayMessage } from "../types/relay.js";
import {
  MAX_WS_MESSAGE_BYTES, MAX_WS_OUTBOUND_QUEUE_BYTES, MAX_WS_OUTBOUND_QUEUE_MESSAGES,
} from "./constants.js";

type OutboundItem = { payload: string; bytes: number };
type OutboundState = { items: OutboundItem[]; bytes: number; sending: boolean };
const queues = new WeakMap<WebSocket, OutboundState>();

const terminate = (socket: WebSocket) => {
  queues.delete(socket);
  try { socket.terminate(); } catch {}
  return false;
};

const flush = (socket: WebSocket, state: OutboundState) => {
  if (state.sending) return;
  const item = state.items.shift();
  if (!item) return;
  state.sending = true;
  try {
    socket.send(item.payload, (error) => {
      if (queues.get(socket) !== state) return;
      state.bytes -= item.bytes;
      state.sending = false;
      error ? terminate(socket) : flush(socket, state);
    });
  } catch {
    terminate(socket);
  }
};

export const sendRelayMessage = (socket: WebSocket, message: RelayMessage) => {
  if (socket.readyState !== WebSocket.OPEN) {
    queues.delete(socket);
    return false;
  }
  let payload: string;
  try { payload = JSON.stringify(message); } catch { return terminate(socket); }
  const bytes = Buffer.byteLength(payload);
  const state = queues.get(socket) || { items: [], bytes: 0, sending: false };
  const messages = state.items.length + Number(state.sending);
  if (bytes > MAX_WS_MESSAGE_BYTES || state.bytes + bytes > MAX_WS_OUTBOUND_QUEUE_BYTES ||
    messages >= MAX_WS_OUTBOUND_QUEUE_MESSAGES || socket.bufferedAmount > MAX_WS_OUTBOUND_QUEUE_BYTES)
    return terminate(socket);
  if (!queues.has(socket)) queues.set(socket, state);
  state.items.push({ payload, bytes });
  state.bytes += bytes;
  flush(socket, state);
  return true;
};

export const broadcastRelayMessage = (sockets: Iterable<WebSocket>, message: RelayMessage) => {
  for (const socket of sockets) sendRelayMessage(socket, message);
};
