import type { RelayEventBatch, SequencedRelayEvent } from "../../types/mcp.js";
import type { RelayEvent } from "../../types/relay.js";
import { MAX_RELAY_EVENT_BUFFER_BYTES, MAX_RELAY_EVENT_BYTES, MAX_RELAY_EVENT_ENVELOPE_BYTES, MAX_RELAY_EVENTS } from "../../protocol/limits.js";

type StoredEvent = { event: SequencedRelayEvent; bytes: number };

export const createRelayEventBuffer = () => {
  const events: StoredEvent[] = [];
  let latestSequence = 0;
  let latestContinuityResetSequence: number | null = null;
  let retainedBytes = 0;
  const add = (event: RelayEvent) => {
    latestSequence += 1;
    const encodedBytes = Buffer.byteLength(JSON.stringify(event));
    const retained = encodedBytes <= MAX_RELAY_EVENT_BYTES ? event : {
      type: "event" as const,
      name: "relay.eventDropped",
      data: { originalName: event.name.slice(0, 256), reason: "eventByteLimit", encodedBytes },
    };
    const sequenced = { ...retained, sequence: latestSequence };
    const bytes = Buffer.byteLength(JSON.stringify(sequenced));
    events.push({ event: sequenced, bytes });
    retainedBytes += bytes;
    while (events.length > MAX_RELAY_EVENTS || retainedBytes > MAX_RELAY_EVENT_BUFFER_BYTES - MAX_RELAY_EVENT_ENVELOPE_BYTES)
      retainedBytes -= events.shift()!.bytes;
  };
  const markDisconnected = () => {
    add({ type: "event", name: "relay.disconnected", data: { continuity: "unknownUntilReconnect" } });
    latestContinuityResetSequence = latestSequence;
  };
  const read = (limit = 100, afterSequence?: number): RelayEventBatch => {
    const oldestAvailableSequence = events[0]?.event.sequence ?? latestSequence + 1;
    const cursorReset = afterSequence !== undefined && afterSequence > latestSequence;
    const candidates = afterSequence === undefined
      ? events.slice(-limit)
      : cursorReset ? [] : events.filter(({ event }) => event.sequence > afterSequence);
    const selected = afterSequence === undefined ? candidates : candidates.slice(0, limit);
    const droppedCount = afterSequence === undefined || cursorReset
      ? 0 : Math.max(0, oldestAvailableSequence - afterSequence - 1);
    return {
      events: selected.map(({ event }) => event),
      oldestAvailableSequence,
      latestSequence,
      nextSequence: selected.at(-1)?.event.sequence ?? (cursorReset ? latestSequence : afterSequence ?? latestSequence),
      droppedCount,
      hasMore: afterSequence !== undefined && candidates.length > selected.length,
      cursorReset,
      continuityLost: afterSequence !== undefined && latestContinuityResetSequence !== null && afterSequence < latestContinuityResetSequence,
      latestContinuityResetSequence,
    };
  };
  return { add, markDisconnected, read };
};
