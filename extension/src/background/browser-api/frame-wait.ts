import type { JsonValue } from "../../../../src/types/json.js";
import type { BrowserApiHandler } from "./types.js";
import { paramsOf, resolveTabId } from "./parameters.js";
import { toJson } from "./json.js";
import { abortReason, listenForAbort } from "./wait-signal.js";

type FrameDetails = { tabId?: number; frameId: number; parentFrameId?: number; url: string; documentId?: string };

const matches = (frame: FrameDetails, params: Record<string, JsonValue>) =>
  (typeof params.frameId !== "number" || frame.frameId === params.frameId)
  && (typeof params.documentId !== "string" || frame.documentId === params.documentId)
  && (typeof params.parentFrameId !== "number" || frame.parentFrameId === params.parentFrameId)
  && (typeof params.url !== "string" || frame.url === params.url)
  && (typeof params.urlContains !== "string" || frame.url.includes(params.urlContains));

export const handleFrameWaitAction: BrowserApiHandler = async (request, signal) => {
  if (request.action !== "waitFrame") return undefined;
  const tabId = await resolveTabId(request);
  const params = {
    ...paramsOf(request),
    ...(typeof request.target?.frameId === "number" && { frameId: request.target.frameId }),
    ...(request.target?.documentId && { documentId: request.target.documentId }),
  };
  return new Promise<JsonValue>((resolve, reject) => {
    let settled = false;
    let removeAbort: () => void = () => undefined;
    const clean = () => {
      chrome.webNavigation.onCommitted.removeListener(listener);
      clearTimeout(timer);
      removeAbort();
    };
    const finish = (frame: FrameDetails) => {
      if (settled) return;
      settled = true;
      clean();
      resolve(toJson(frame));
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      clean();
      reject(error);
    };
    const listener = (frame: FrameDetails) => {
      if (frame.tabId === tabId && matches(frame, params)) finish(frame);
    };
    chrome.webNavigation.onCommitted.addListener(listener);
    const timeout = request.timeoutMs ?? 30_000;
    const timer = setTimeout(() => fail(new Error("Timed out waiting for a frame.")), timeout);
    removeAbort = listenForAbort(signal, () => fail(abortReason(signal)));
    void chrome.webNavigation.getAllFrames({ tabId }).then((frames) => {
      const existing = (frames || []).find((frame) => matches(frame, params));
      if (existing) finish(existing);
    }).catch((error: unknown) => fail(error instanceof Error ? error : new Error("Unable to inspect frames.")));
  });
};
