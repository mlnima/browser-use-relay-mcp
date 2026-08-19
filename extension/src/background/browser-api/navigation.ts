import type { BrowserApiHandler } from "./types.js";
import { completed, toJson } from "./json.js";
import { paramsOf, resolveTabId } from "./parameters.js";
import { listObservedRequests } from "./request-observer.js";

export const handleNavigationAction: BrowserApiHandler = async (request) => {
  const params = paramsOf(request);
  switch (request.action) {
    case "goto":
      return toJson(await chrome.tabs.update(await resolveTabId(request), { url: params.url as string }));
    case "back":
      await chrome.tabs.goBack(await resolveTabId(request));
      return completed();
    case "forward":
      await chrome.tabs.goForward(await resolveTabId(request));
      return completed();
    case "reload":
      await chrome.tabs.reload(await resolveTabId(request), { bypassCache: params.bypassCache === true });
      return completed();
    case "hardReload":
      await chrome.tabs.reload(await resolveTabId(request), { bypassCache: true });
      return completed();
    case "getNavigationState": {
      const tabId = await resolveTabId(request);
      const [tab, frames] = await Promise.all([
        chrome.tabs.get(tabId),
        chrome.webNavigation.getAllFrames({ tabId }),
      ]);
      const redirects = listObservedRequests()
        .filter((record) => record.tabId === tabId && Array.isArray(record.redirectChain))
        .map((record) => ({ requestId: record.requestId, chain: record.redirectChain, phase: record.phase }));
      return toJson({ tab, frames: frames || [], redirects, redirectObservationAvailable: Boolean(chrome.webRequest?.onBeforeRedirect) });
    }
    default:
      return undefined;
  }
};
