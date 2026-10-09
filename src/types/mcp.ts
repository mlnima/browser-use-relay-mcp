import type { ActionRequest, ActionResult } from "./action.js";
import type { RelayEvent } from "./relay.js";
import type { ActionDelaySettings, InputEngine, InputEngineSettings } from "./settings.js";

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
  inputEngine: () => InputEngine;
  onInputEngineChanged: (receive: (engine: InputEngine) => void) => () => void;
  connect: (signal?: AbortSignal) => Promise<void>;
  execute: (request: ActionRequest, signal?: AbortSignal) => Promise<ActionResult>;
  events: (limit?: number, afterSequence?: number) => RelayEventBatch;
  close: () => Promise<void>;
};

export type McpConfiguration = ActionDelaySettings & InputEngineSettings & {
  relayUrl: string;
  connectTimeoutMs: number;
  actionTimeoutMs: number;
};
