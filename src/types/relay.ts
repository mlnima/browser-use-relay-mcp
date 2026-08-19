import type { ActionRequest, ActionResult } from "./action.js";
import type { JsonValue } from "./json.js";
import type { RelayAddresses, RelaySettings, RelayStatus } from "./settings.js";

export type RelayHello = {
  type: "hello";
  protocolVersion: string;
  client: "mcp";
  name: string;
};

export type RelayRequest = { type: "action"; request: ActionRequest };
export type RelayResponse = { type: "result"; result: ActionResult };
export type RelayCancel = { type: "cancel"; id: string; reason?: string };
export type RelayEvent = { type: "event"; name: string; data?: JsonValue };
export type RelayPing = { type: "ping"; sentAt: number };
export type RelayPong = { type: "pong"; sentAt: number };

export type RelayMessage =
  | RelayHello
  | RelayRequest
  | RelayResponse
  | RelayCancel
  | RelayEvent
  | RelayPing
  | RelayPong;

export type NativeConfigure = { type: "configure"; generation: number; settings: RelaySettings };
export type NativeQuiesce = { type: "quiesce"; generation: number };
export type NativeQuiesced = { type: "quiesced"; generation: number };
export type NativeActionResult = { type: "actionResult"; result: ActionResult };
export type NativeActionRequest = { type: "actionRequest"; request: ActionRequest };
export type NativeState = {
  type: "state";
  generation: number;
  settings: RelaySettings;
  addresses: RelayAddresses;
  status: RelayStatus;
};

export type NativeMessage =
  | NativeConfigure
  | NativeQuiesce
  | NativeQuiesced
  | NativeActionResult
  | NativeActionRequest
  | NativeState
  | RelayCancel
  | RelayEvent;
