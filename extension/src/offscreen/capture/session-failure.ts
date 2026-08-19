import { releaseSession } from "./playback.js";
import { rememberCaptureFailure } from "./retention.js";
import { captureSessions, type CaptureSession } from "./state.js";

export const failCaptureSession = (session: CaptureSession, value: unknown) => {
  if (session.error) return session.error;
  const failure = rememberCaptureFailure(session.captureId, value);
  session.error = failure;
  if (session.durationTimer) clearTimeout(session.durationTimer);
  try {
    if (session.recorder.state !== "inactive") session.recorder.stop();
  } catch {}
  session.resolveStopped();
  void releaseSession(session);
  void session.stopped.then(async () => {
    if (session.finishing) return;
    if (captureSessions.get(session.captureId) === session) captureSessions.delete(session.captureId);
    session.chunks.length = 0;
    await releaseSession(session);
  });
  return failure;
};
