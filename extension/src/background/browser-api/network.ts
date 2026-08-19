import type { BrowserApiHandler } from "./types.js";
import { completed, toJson } from "./json.js";
import { executeExtensionFetch } from "./extension-fetch.js";
import { getObservedRequest, listObservedRequests, observedRequestStats } from "./request-observer.js";
import { paramsOf, resolveTabId } from "./parameters.js";
import { cdpRequestStats, getCdpRequest, listCdpRequests } from "../debugger/cdp-network-store";
import { ensureDebugger } from "../debugger/debugger-session";
import { NETWORK_LIST_DEFAULT_LIMIT, NETWORK_LIST_MAX_LIMIT } from "./network-observation-limits";
let ruleQueue: Promise<void> = Promise.resolve();
const queuedRuleChange = <Value>(change: () => Promise<Value>) => {
  const result = ruleQueue.then(change, change);
  ruleQueue = result.then(() => undefined, () => undefined);
  return result;
};
const requestListLimit = (value: unknown) => {
  const requested = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : NETWORK_LIST_DEFAULT_LIMIT;
  return Math.min(NETWORK_LIST_MAX_LIMIT, Math.max(1, requested));
};
const networkRules = (request: Parameters<BrowserApiHandler>[0]) => queuedRuleChange(async () => {
  const params = paramsOf(request);
  const session = params.scope === "session";
  const current = session
    ? await chrome.declarativeNetRequest.getSessionRules()
    : await chrome.declarativeNetRequest.getDynamicRules();
  const options: chrome.declarativeNetRequest.UpdateRuleOptions = {
    removeRuleIds: Array.isArray(params.removeRuleIds)
      ? params.removeRuleIds as number[]
      : params.rules ? current.map(({ id }) => id) : [],
    addRules: (params.rules || params.addRules || []) as unknown as chrome.declarativeNetRequest.Rule[],
  };
  if (session) await chrome.declarativeNetRequest.updateSessionRules(options);
  else await chrome.declarativeNetRequest.updateDynamicRules(options);
  return toJson(session
    ? await chrome.declarativeNetRequest.getSessionRules()
    : await chrome.declarativeNetRequest.getDynamicRules());
});
export const clearRelayNetworkRules = (scope?: unknown) => queuedRuleChange(async () => {
  if (scope !== "session") {
    const dynamic = await chrome.declarativeNetRequest.getDynamicRules();
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: dynamic.map(({ id }) => id) });
  }
  if (scope === "session" || scope === "all") {
    const session = await chrome.declarativeNetRequest.getSessionRules();
    await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: session.map(({ id }) => id) });
  }
  return completed();
});
export const handleNetworkAction: BrowserApiHandler = async (request, signal) => {
  const params = paramsOf(request);
  switch (request.action) {
    case "enableResponseBodyCapture": {
      const tabId = await resolveTabId(request);
      signal?.throwIfAborted();
      await ensureDebugger(tabId);
      signal?.throwIfAborted();
      return toJson({ enabled: true, tabId, appliesToFutureRequests: true });
    }
    case "listRequests": {
      const records = [...listObservedRequests(), ...listCdpRequests()];
      const tabId = request.target?.tabId ?? params.tabId;
      const filtered = records.filter((record) =>
        (typeof tabId !== "number" || record.tabId === tabId)
        && (typeof params.source !== "string" || record.source === params.source)
        && (typeof params.method !== "string" || record.method === params.method)
        && (typeof params.type !== "string" || record.type === params.type)
        && (typeof params.phase !== "string" || record.phase === params.phase)
        && (typeof params.statusCode !== "number" || record.statusCode === params.statusCode)
        && (typeof params.urlContains !== "string" || String(record.url).includes(params.urlContains)));
      const limit = requestListLimit(params.limit);
      const requests = filtered.slice(-limit);
      const webRequest = observedRequestStats();
      const cdp = cdpRequestStats();
      return toJson({
        requests, limit, matched: filtered.length, returned: requests.length,
        truncated: requests.length < filtered.length,
        dropped: {
          webRequest: { records: webRequest.droppedRecords, bytes: webRequest.droppedBytes },
          cdp: { records: cdp.droppedRecords, bytes: cdp.droppedBytes },
        },
      });
    }
    case "getRequest": {
      const requestId = String(params.requestId || "");
      const tabId = request.target?.tabId ?? params.tabId;
      const record = params.source === "cdp" ? getCdpRequest(requestId, typeof tabId === "number" ? tabId : undefined)
        : params.source === "webRequest" ? getObservedRequest(requestId)
          : getCdpRequest(requestId, typeof tabId === "number" ? tabId : undefined) || getObservedRequest(requestId);
      return toJson(record);
    }
    case "setNetworkRules":
      return networkRules(request);
    case "clearNetworkRules":
      return clearRelayNetworkRules(request.params?.scope);
    case "fetch":
      return executeExtensionFetch(request, signal);
    default:
      return undefined;
  }
};
