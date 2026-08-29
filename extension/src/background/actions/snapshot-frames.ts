import type { ActionRequest } from "../../../../src/types/action.js";
import { MAX_SNAPSHOT_FRAMES } from "../../../../src/protocol/limits.js";

export type FrameReference = { frameId: number; documentId?: string; url: string };

export const selectSnapshotFrames = async (request: ActionRequest, tabId: number, tabUrl: string, limit: (value: string) => string | undefined) => {
  const enumerated = await chrome.webNavigation.getAllFrames({ tabId }) || [];
  const selected = enumerated.find((frame) => request.target?.documentId
    ? frame.documentId === request.target.documentId
    : frame.frameId === (request.target?.frameId ?? 0));
  const fallback = selected || {
    frameId: request.target?.frameId ?? 0,
    documentId: request.target?.documentId,
    url: tabUrl,
  };
  const available = request.params?.allFrames === true
    ? enumerated.length ? enumerated : [fallback]
    : [fallback];
  const frames: FrameReference[] = available.slice(0, MAX_SNAPSHOT_FRAMES).map((frame) => ({ ...frame, url: limit(frame.url)! }));
  return { frames, totalFrameCount: available.length, omittedFrameCount: Math.max(0, available.length - frames.length) };
};
