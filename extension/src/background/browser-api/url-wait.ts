import type { JsonValue } from "../../../../src/types/json.js";
import type { BrowserApiHandler } from "./types.js";
import { paramsOf, resolveTabId } from "./parameters.js";
import { toJson } from "./json.js";
import { abortReason, listenForAbort } from "./wait-signal.js";

const matchesUrl = (url: string, params: Record<string, JsonValue>, pattern?: RegExp) =>
  (typeof params.url !== "string" || url === params.url)
  && (typeof params.urlContains !== "string" || url.includes(params.urlContains))
  && (!pattern || pattern.test(url));

export const waitForUrl = async (request: Parameters<BrowserApiHandler>[0], signal?: AbortSignal) => {
  const tabId = await resolveTabId(request);
  const params = paramsOf(request);
  const pattern = typeof params.urlPattern === "string" ? new RegExp(params.urlPattern) : undefined;
  return new Promise<JsonValue>((resolve, reject) => {
    let settled = false;
    let removeAbort: () => void = () => undefined;
    const clean = () => {
      chrome.tabs.onUpdated.removeListener(listener);
      clearTimeout(timer);
      removeAbort();
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      clean();
      reject(error);
    };
    const finish = (tab: chrome.tabs.Tab) => {
      if (settled) return;
      settled = true;
      clean();
      resolve(toJson(tab));
    };
    const listener: Parameters<typeof chrome.tabs.onUpdated.addListener>[0] = (changedId, change, tab) => {
      if (changedId === tabId && change.url && matchesUrl(change.url, params, pattern)) finish(tab);
    };
    chrome.tabs.onUpdated.addListener(listener);
    const timeout = request.timeoutMs ?? 30_000;
    const timer = setTimeout(() => fail(new Error("Timed out waiting for the tab URL.")), timeout);
    removeAbort = listenForAbort(signal, () => fail(abortReason(signal)));
    void chrome.tabs.get(tabId).then((tab) => {
      if (tab.url && matchesUrl(tab.url, params, pattern)) finish(tab);
    }).catch((error: unknown) => fail(error instanceof Error ? error : new Error("Unable to read the tab URL.")));
  });
};
