import type { CaptureMessage, CaptureStatusResult } from "../../background/browser-api/tab-capture/types.js";
import { cancelCapture } from "./cancel.js";
import { releaseCapture } from "./stop.js";
import { startCapture } from "./start.js";
import { captureFailureMessage } from "./retention.js";
import { captureSessions, startingCaptures } from "./state.js";
import { stopCapture } from "./stop.js";

const captureStatus = (captureId: string): CaptureStatusResult => {
  const session = captureSessions.get(captureId);
  if (session?.error) return { captureId, active: false, state: "failed", error: session.error.message };
  if (session) return { captureId, active: true, state: "active", startedAt: session.startedAt, bytes: session.bytes };
  if (startingCaptures.has(captureId)) return { captureId, active: true, state: "starting" };
  const error = captureFailureMessage(captureId);
  return error ? { captureId, active: false, state: "failed", error } : { captureId, active: false, state: "missing" };
};
export const handleCaptureMessage = async (message: CaptureMessage) => {
  if (message.operation === "status") return captureStatus(message.captureId);
  if (message.operation === "start") return startCapture(message);
  if (message.operation === "stop") return stopCapture(message.captureId);
  if (message.operation === "cancel") return cancelCapture(message.captureId);
  return releaseCapture(message.resourceId);
};
