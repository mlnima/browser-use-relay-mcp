import { failCaptureSession } from "./session-failure.js";
import { captureSessions, captureStartControllers, startingCaptures } from "./state.js";

export const cancelCapture = (captureId: string) => {
  const starting = startingCaptures.has(captureId);
  const session = captureSessions.get(captureId);
  captureStartControllers.get(captureId)?.abort(new Error("TAB_CAPTURE_CANCELLED: Tab capture was cancelled."));
  if (session) failCaptureSession(session, new Error("TAB_CAPTURE_CANCELLED: Tab capture was cancelled."));
  return { captureId, cancelled: starting || Boolean(session) };
};
