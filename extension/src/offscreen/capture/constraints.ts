import type { CaptureStartMessage } from "../../background/browser-api/tab-capture/types.js";

const objectValue = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const trackConstraints = (value: unknown, streamId: string) => {
  if (value === false) return false;
  const supplied = objectValue(value);
  return {
    ...supplied,
    mandatory: {
      ...objectValue(supplied.mandatory),
      chromeMediaSource: "tab",
      chromeMediaSourceId: streamId,
    },
  };
};

export const captureConstraints = (
  message: CaptureStartMessage,
): MediaStreamConstraints => ({
  audio: trackConstraints(message.mediaConstraints.audio ?? true, message.streamId),
  video: trackConstraints(message.mediaConstraints.video ?? true, message.streamId),
}) as unknown as MediaStreamConstraints;
