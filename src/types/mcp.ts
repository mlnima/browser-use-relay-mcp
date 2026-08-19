import type { ActionRequest, ActionResult } from "./action.js";
import type { RelayEvent } from "./relay.js";

export type SequencedRelayEvent = RelayEvent & { sequence: number };
export type RelayEventBatch = {
  events: readonly SequencedRelayEvent[];
  oldestAvailableSequence: number;
  latestSequence: number;
  nextSequence: number;
  droppedCount: number;
  hasMore: boolean;
  cursorReset: boolean;
  continuityLost: boolean;
  latestContinuityResetSequence: number | null;
};

export type RelayClient = {
  connect: (signal?: AbortSignal) => Promise<void>;
  execute: (request: ActionRequest, signal?: AbortSignal) => Promise<ActionResult>;
  events: (limit?: number, afterSequence?: number) => RelayEventBatch;
  close: () => Promise<void>;
};

export type McpConfiguration = {
  relayUrl: string;
  connectTimeoutMs: number;
  actionTimeoutMs: number;
};
