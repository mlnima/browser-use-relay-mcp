import type { ContentActionHandler } from "./types.js";
import { requireElement } from "./element.js";

const media = (target?: Element) => {
  const element = requireElement(target);
  if (!(element instanceof HTMLMediaElement)) throw new Error("The target is not audio or video.");
  return element;
};

export const mediaActionHandlers: Record<string, ContentActionHandler> = {
  playMedia: async ({ target }) => (await media(target).play(), true),
  pauseMedia: async ({ target }) => (media(target).pause(), true),
  seekMedia: async ({ target, request }) => (media(target).currentTime = Number(request.params?.time ?? 0)),
  setMediaVolume: async ({ target, request }) => (media(target).volume = Number(request.params?.volume ?? 1)),
  muteMedia: async ({ target }) => (media(target).muted = true),
  unmuteMedia: async ({ target }) => (media(target).muted = false),
  setPlaybackRate: async ({ target, request }) => (media(target).playbackRate = Number(request.params?.rate ?? 1)),
  setMediaLoop: async ({ target, request }) => (media(target).loop = Boolean(request.params?.enabled)),
  selectCaptionTrack: async ({ target, request }) => {
    const element = media(target);
    const index = Number(request.params?.index ?? 0);
    for (let position = 0; position < element.textTracks.length; position += 1) element.textTracks[position].mode = position === index ? "showing" : "disabled";
    return index;
  },
  requestPictureInPicture: async ({ target }) => {
    const element = media(target);
    if (!(element instanceof HTMLVideoElement)) throw new Error("Picture-in-picture requires video.");
    await element.requestPictureInPicture();
    return true;
  },
  requestFullscreen: async ({ target }) => (await requireElement(target).requestFullscreen(), true),
};
