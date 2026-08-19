import {
  FORWARDED_EVENT_INTERVAL_MS, MAX_FORWARDED_EVENT_BYTES,
  MAX_FORWARDED_EVENT_QUEUE_BYTES, MAX_FORWARDED_EVENTS,
} from "../../../../src/protocol/limits.js";
import type { NativeMessage } from "../../../../src/types/relay.js";

type EventMessage = Extract<NativeMessage, { type: "event" }>;
type Item = { message: EventMessage; bytes: number; key?: string };
const encoder = new TextEncoder();
const eventKey = (message: EventMessage) => {
  const data = message.data && typeof message.data === "object" && !Array.isArray(message.data)
    ? message.data as Record<string, unknown> : undefined;
  if (message.name === "page.changed") return `${message.name}:${data?.tabId}:${data?.frameId}`;
  if (message.name === "tab.updated") return `${message.name}:${data?.tabId}`;
  if (message.name === "download.changed") return `${message.name}:${data?.id}`;
  return undefined;
};

export const createEventForwardingQueue = (connected: () => boolean, send: (message: NativeMessage) => void) => {
  const items: Item[] = [];
  let bytes = 0;
  let dropped = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const clear = () => { items.length = 0; bytes = 0; dropped = 0; };
  const schedule = () => { timer ||= setTimeout(flush, FORWARDED_EVENT_INTERVAL_MS); };
  const flush = () => {
    timer = undefined;
    if (!connected()) return clear();
    const messages: EventMessage[] = [];
    if (dropped) {
      messages.push({ type: "event", name: "relay.eventsDropped", data: { count: dropped, reason: "extensionBackpressure" } });
      dropped = 0;
    }
    const item = items.shift();
    if (item) { bytes -= item.bytes; messages.push(item.message); }
    for (const message of messages) try { send(message); } catch { dropped += 1; }
    if (items.length || dropped) schedule();
  };
  const enqueue = (message: EventMessage) => {
    if (!connected()) return clear();
    const size = encoder.encode(JSON.stringify(message)).byteLength;
    if (size > MAX_FORWARDED_EVENT_BYTES) { dropped += 1; schedule(); return; }
    const key = eventKey(message);
    const previous = key ? items.findIndex((item) => item.key === key) : -1;
    if (previous >= 0) {
      bytes -= items[previous].bytes;
      items.splice(previous, 1);
      dropped += 1;
    }
    while (items.length >= MAX_FORWARDED_EVENTS || bytes + size > MAX_FORWARDED_EVENT_QUEUE_BYTES) {
      const removed = items.shift();
      if (!removed) break;
      bytes -= removed.bytes;
      dropped += 1;
    }
    items.push({ message, bytes: size, key });
    bytes += size;
    schedule();
  };
  return enqueue;
};
