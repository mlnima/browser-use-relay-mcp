import type { JsonValue } from "../../../../src/types/json.js";
import type { BrowserApiHandler } from "./types.js";
import { paramsOf, resolveTabId } from "./parameters.js";
import { toJson } from "./json.js";
import { abortReason, listenForAbort } from "./wait-signal.js";

type NavigationDetails = { tabId: number; frameId: number; url: string; timeStamp: number };
type NavigationEvent = { addListener: (listener: (details: NavigationDetails) => void) => void; removeListener: (listener: (details: NavigationDetails) => void) => void };

const matchesUrl = (url: string, params: Record<string, JsonValue>, pattern?: RegExp) =>
  (typeof params.url !== "string" || url === params.url)
  && (typeof params.urlContains !== "string" || url.includes(params.urlContains))
  && (!pattern || pattern.test(url));

export const waitForNavigation = async (request: Parameters<BrowserApiHandler>[0], signal?: AbortSignal) => {
  const tabId = await resolveTabId(request);
  const params = paramsOf(request);
  const pattern = typeof params.urlPattern === "string" ? new RegExp(params.urlPattern) : undefined;
  const wantedFrame = params.allFrames === true ? undefined : request.target?.frameId ?? params.frameId ?? 0;
  return new Promise<JsonValue>((resolve, reject) => {
    let settled = false;
    let removeAbort: () => void = () => undefined;
    const listeners: Array<[NavigationEvent, (details: NavigationDetails) => void]> = [];
    const clean = () => {
      for (const [event, listener] of listeners) event.removeListener(listener);
      clearTimeout(timer);
      removeAbort();
    };
    const finish = (details: NavigationDetails, event: string) => {
      const matches = details.tabId === tabId
        && (typeof wantedFrame !== "number" || details.frameId === wantedFrame)
        && (typeof params.event !== "string" || params.event === event)
        && matchesUrl(details.url, params, pattern);
      if (!matches || settled) return;
      settled = true;
      clean();
      resolve(toJson({ event, ...details }));
    };
    const add = (event: NavigationEvent, name: string) => {
      const listener = (details: NavigationDetails) => finish(details, name);
      listeners.push([event, listener]);
      event.addListener(listener);
    };
    add(chrome.webNavigation.onCommitted, "committed");
    add(chrome.webNavigation.onDOMContentLoaded, "domContentLoaded");
    add(chrome.webNavigation.onCompleted, "completed");
    add(chrome.webNavigation.onErrorOccurred, "error");
    add(chrome.webNavigation.onHistoryStateUpdated, "historyStateUpdated");
    add(chrome.webNavigation.onReferenceFragmentUpdated, "referenceFragmentUpdated");
    const timeout = request.timeoutMs ?? 30_000;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      clean();
      reject(new Error("Timed out waiting for navigation."));
    }, timeout);
    removeAbort = listenForAbort(signal, () => {
      if (settled) return;
      settled = true;
      clean();
      reject(abortReason(signal));
    });
  });
};
