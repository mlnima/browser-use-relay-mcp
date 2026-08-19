import type { CaptureStopResult } from "../../background/browser-api/tab-capture/types.js";
import { CAPTURE_RECORDER_STOP_TIMEOUT_MS } from "./limits.js";
import { releaseSession } from "./playback.js";
import {
  captureFailureMessage, rememberCaptureFailure, releaseCaptureResource, retainCaptureResource,
} from "./retention.js";
import { captureSessions, type CaptureSession } from "./state.js";
import { failCaptureSession } from "./session-failure.js";

const finalizeCapture = async (session: CaptureSession): Promise<CaptureStopResult> => {
  try {
    session.stopRequested = true;
    const deadline = setTimeout(() => failCaptureSession(
      session, new Error("TAB_CAPTURE_STOP_TIMEOUT: The media recorder did not stop in time."),
    ), CAPTURE_RECORDER_STOP_TIMEOUT_MS);
    if (session.recorder.state !== "inactive") session.recorder.stop();
    try {
      await session.stopped;
    } finally {
      clearTimeout(deadline);
    }
    if (session.error) throw session.error;
    const stoppedAt = Date.now();
    const mimeType = session.recorder.mimeType || session.chunks[0]?.type || "application/octet-stream";
    const recording = new Blob(session.chunks, { type: mimeType });
    captureSessions.delete(session.captureId);
    const resource = retainCaptureResource(recording);
    return {
      captureId: session.captureId,
      tabId: session.tabId,
      ...resource,
      mimeType,
      size: recording.size,
      startedAt: session.startedAt,
      stoppedAt,
      durationMs: stoppedAt - session.startedAt,
    };
  } catch (error) {
    throw rememberCaptureFailure(session.captureId, error);
  } finally {
    captureSessions.delete(session.captureId);
    session.chunks.length = 0;
    await releaseSession(session);
  }
};

export const stopCapture = async (captureId: string) => {
  const session = captureSessions.get(captureId);
  if (!session) {
    const failure = captureFailureMessage(captureId);
    if (failure) throw new Error(failure);
    throw new Error(`No active tab capture exists for ${captureId}.`);
  }
  session.finishing ||= finalizeCapture(session);
  return session.finishing;
};
export const releaseCapture = (resourceId: string) => releaseCaptureResource(resourceId);
