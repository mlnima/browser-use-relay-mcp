import type { JsonValue } from "../../../../../src/types/json.js";

export type CaptureStartMessage = {
  type: "relay.offscreen.capture";
  operation: "start";
  captureId: string;
  streamId: string;
  tabId: number;
  mediaConstraints: Record<string, JsonValue>;
  recorderOptions: Record<string, JsonValue>;
  timeslice?: number;
};

export type CaptureStopMessage = {
  type: "relay.offscreen.capture";
  operation: "stop";
  captureId: string;
};

export type CaptureCancelMessage = {
  type: "relay.offscreen.capture";
  operation: "cancel";
  captureId: string;
};

export type CaptureReleaseMessage = {
  type: "relay.offscreen.capture";
  operation: "release";
  resourceId: string;
};

export type CaptureStatusMessage = {
  type: "relay.offscreen.capture";
  operation: "status";
  captureId: string;
};

export type CaptureStatusResult = {
  captureId: string;
  active: boolean;
  state: "missing" | "starting" | "active" | "failed";
  error?: string;
  startedAt?: number;
  bytes?: number;
};

export type CaptureMessage = CaptureStartMessage | CaptureStopMessage | CaptureCancelMessage | CaptureReleaseMessage | CaptureStatusMessage;

export type CaptureStartResult = {
  captureId: string;
  tabId: number;
  startedAt: number;
  mimeType: string;
  tracks: Array<{ kind: string; label: string; settings: Record<string, JsonValue> }>;
};

export type CaptureStopResult = {
  captureId: string;
  tabId: number;
  resourceId: string;
  blobUrl: string;
  mimeType: string;
  size: number;
  startedAt: number;
  stoppedAt: number;
  durationMs: number;
};
