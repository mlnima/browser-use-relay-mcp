import type { CaptureSession } from "./state.js";
import { CAPTURE_RECORDER_STOP_TIMEOUT_MS } from "./limits.js";

const awaitAudio = <T>(pending: Promise<T>, signal = AbortSignal.timeout(CAPTURE_RECORDER_STOP_TIMEOUT_MS)) => {
  let rejectAbort = (_error: Error): void => undefined;
  const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
  const abort = () => rejectAbort(signal.reason instanceof Error ? signal.reason : new Error("Capture audio operation cancelled."));
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  return Promise.race([pending, aborted]).finally(() => signal.removeEventListener("abort", abort));
};

export const connectPlayback = async (stream: MediaStream, signal?: AbortSignal) => {
  if (stream.getAudioTracks().length === 0) return {};
  const audioContext = new AudioContext();
  const audioSource = audioContext.createMediaStreamSource(stream);
  audioSource.connect(audioContext.destination);
  try {
    if (audioContext.state === "suspended") await awaitAudio(audioContext.resume(), signal);
    return { audioContext, audioSource };
  } catch (error) {
    audioSource.disconnect();
    await awaitAudio(audioContext.close()).catch(() => undefined);
    throw error;
  }
};

export const releaseSession = async (session: CaptureSession) => {
  session.releasing ||= (async () => {
    if (session.durationTimer) clearTimeout(session.durationTimer);
    session.durationTimer = undefined;
    session.stream.getTracks().forEach((track) => track.stop());
    session.audioSource?.disconnect();
    if (session.audioContext && session.audioContext.state !== "closed") {
      await awaitAudio(session.audioContext.close()).catch(() => undefined);
    }
  })();
  await session.releasing;
};
