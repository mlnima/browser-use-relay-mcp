import { MAX_CAPTURE_AGGREGATE_BYTES, MAX_CAPTURE_BYTES, MAX_CAPTURE_DURATION_MS } from "./limits.js";
import { releaseSession } from "./playback.js";
import { totalCaptureBytes } from "./retention.js";
import { failCaptureSession } from "./session-failure.js";
import type { CaptureSession } from "./state.js";

const recorderError = (event: Event) => {
  const error = (event as Event & { error?: DOMException }).error;
  return new Error(`TAB_CAPTURE_RECORDER_ERROR: ${error?.message || "Tab media recording failed."}`);
};
export const attachRecorderEvents = (session: CaptureSession) => {
  session.recorder.addEventListener("dataavailable", (event) => {
    if (session.error || event.data.size <= 0) return;
    if (session.bytes + event.data.size > MAX_CAPTURE_BYTES) {
      failCaptureSession(session, new Error("CAPTURE_BYTE_LIMIT: The recording exceeded its byte limit."));
      return;
    }
    if (totalCaptureBytes() + event.data.size > MAX_CAPTURE_AGGREGATE_BYTES) {
      failCaptureSession(session, new Error("CAPTURE_AGGREGATE_BYTE_LIMIT: Active captures exceeded the aggregate byte limit."));
      return;
    }
    session.chunks.push(event.data);
    session.bytes += event.data.size;
  });
  session.recorder.addEventListener("stop", () => {
    if (session.durationTimer) clearTimeout(session.durationTimer);
    if (!session.stopRequested && !session.error) {
      failCaptureSession(session, new Error("CAPTURE_STREAM_ENDED: The captured tab media stream ended."));
      return;
    }
    session.resolveStopped();
    void releaseSession(session);
  }, { once: true });
  session.recorder.addEventListener("error", (event) => failCaptureSession(session, recorderError(event)), { once: true });
  session.durationTimer = setTimeout(() => failCaptureSession(
    session, new Error("CAPTURE_DURATION_LIMIT: The recording exceeded its duration limit."),
  ), MAX_CAPTURE_DURATION_MS);
};
