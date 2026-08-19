import type { CaptureStartMessage, CaptureStartResult } from "../../background/browser-api/tab-capture/types.js";
import { captureConstraints } from "./constraints.js";
import {
  CAPTURE_START_TIMEOUT_MS, DEFAULT_CAPTURE_TIMESLICE_MS, MAX_CAPTURE_AGGREGATE_BYTES, MAX_CAPTURE_SESSIONS,
  MAX_CAPTURE_TIMESLICE_MS, MIN_CAPTURE_TIMESLICE_MS,
} from "./limits.js";
import { connectPlayback, releaseSession } from "./playback.js";
import { attachRecorderEvents } from "./recorder-events.js";
import { clearCaptureFailure, rememberCaptureFailure, totalCaptureBytes } from "./retention.js";
import { captureSessions, captureStartControllers, startingCaptures, type CaptureSession } from "./state.js";

const trackDetails = (track: MediaStreamTrack) => ({
  kind: track.kind,
  label: track.label,
  settings: JSON.parse(JSON.stringify(track.getSettings())) as Record<string, never>,
});
const recordingTimeslice = (requested?: number) => {
  const value = requested ?? DEFAULT_CAPTURE_TIMESLICE_MS;
  if (!Number.isFinite(value)) throw new Error("CAPTURE_TIMESLICE_INVALID: The recording timeslice must be finite.");
  return Math.min(MAX_CAPTURE_TIMESLICE_MS, Math.max(MIN_CAPTURE_TIMESLICE_MS, value));
};
const failStart = (captureId: string, message: string): never => {
  throw rememberCaptureFailure(captureId, new Error(message));
};
const acquireStream = async (message: CaptureStartMessage, signal: AbortSignal) => {
  const pending = navigator.mediaDevices.getUserMedia(captureConstraints(message));
  let rejectAbort = (_error: Error): void => undefined;
  const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
  const abort = () => rejectAbort(signal.reason instanceof Error
    ? signal.reason : new Error("TAB_CAPTURE_CANCELLED: Tab capture was cancelled."));
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  try {
    return await Promise.race([pending, aborted]);
  } catch (error) {
    void pending.then((stream) => stream.getTracks().forEach((track) => track.stop()), () => undefined);
    throw error;
  } finally {
    signal.removeEventListener("abort", abort);
  }
};

export const startCapture = async (message: CaptureStartMessage): Promise<CaptureStartResult> => {
  if (captureSessions.has(message.captureId) || startingCaptures.has(message.captureId))
    throw new Error(`Capture ${message.captureId} is already active.`);
  clearCaptureFailure(message.captureId);
  if (captureSessions.size + startingCaptures.size >= MAX_CAPTURE_SESSIONS)
    failStart(message.captureId, "CAPTURE_SESSION_LIMIT: The concurrent tab-capture limit has been reached.");
  if (totalCaptureBytes() >= MAX_CAPTURE_AGGREGATE_BYTES)
    failStart(message.captureId, "CAPTURE_AGGREGATE_BYTE_LIMIT: Retained captures consume the capture byte limit.");
  startingCaptures.add(message.captureId);
  const controller = new AbortController();
  captureStartControllers.set(message.captureId, controller);
  const deadline = setTimeout(() => controller.abort(
    new Error("TAB_CAPTURE_START_TIMEOUT: Tab capture media acquisition timed out."),
  ), CAPTURE_START_TIMEOUT_MS);
  let session: CaptureSession | undefined;
  let stream: MediaStream | undefined;
  try {
    const mimeType = message.recorderOptions.mimeType;
    if (typeof mimeType === "string" && !MediaRecorder.isTypeSupported(mimeType))
      throw new Error(`MediaRecorder does not support ${mimeType}.`);
    const timeslice = recordingTimeslice(message.timeslice);
    stream = await acquireStream(message, controller.signal);
    const recorder = new MediaRecorder(stream, message.recorderOptions as unknown as MediaRecorderOptions);
    const playback = await connectPlayback(stream, controller.signal);
    let resolveStopped: () => void = () => undefined;
    const stopped = new Promise<void>((resolve) => { resolveStopped = resolve; });
    session = {
      captureId: message.captureId, tabId: message.tabId, stream, recorder, chunks: [], bytes: 0,
      startedAt: Date.now(), stopped, resolveStopped, ...playback,
    };
    captureSessions.set(message.captureId, session);
    attachRecorderEvents(session);
    recorder.start(timeslice);
    return {
      captureId: message.captureId, tabId: message.tabId, startedAt: session.startedAt,
      mimeType: recorder.mimeType, tracks: stream.getTracks().map(trackDetails),
    };
  } catch (error) {
    captureSessions.delete(message.captureId);
    if (session) {
      session.chunks.length = 0;
      await releaseSession(session);
    } else stream?.getTracks().forEach((track) => track.stop());
    throw rememberCaptureFailure(message.captureId, error);
  } finally {
    clearTimeout(deadline);
    captureStartControllers.delete(message.captureId);
    startingCaptures.delete(message.captureId);
  }
};
