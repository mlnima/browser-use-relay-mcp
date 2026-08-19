import type { JsonValue } from "../../../../src/types/json.js";
import { getState } from "../state/state-store";
import { boundedHeaderList, boundedNetworkText, jsonByteLength } from "./network-field-bounds";
import {
  NETWORK_ERROR_MAX_BYTES, NETWORK_REDIRECT_MAX_BYTES, NETWORK_REDIRECT_MAX_COUNT,
  NETWORK_TEXT_MAX_BYTES, NETWORK_TOKEN_MAX_BYTES, NETWORK_URL_MAX_BYTES, WEB_REQUEST_STORE_MAX_BYTES,
} from "./network-observation-limits";
import { createNetworkRecordStore } from "./network-record-store";

export type ObservedRequest = Record<string, JsonValue>;
type Observer = (record: ObservedRequest) => void;
const observers = new Set<Observer>();
const filter = { urls: ["<all_urls>"] };
const store = createNetworkRecordStore<ObservedRequest>(WEB_REQUEST_STORE_MAX_BYTES);
const redirectChain = (current: JsonValue | undefined, next: JsonValue) => {
  const chain: JsonValue[] = [...(Array.isArray(current) ? current : []), next].slice(-NETWORK_REDIRECT_MAX_COUNT);
  while (chain.length && jsonByteLength(chain) > NETWORK_REDIRECT_MAX_BYTES) chain.shift();
  return chain;
};

const update = (requestId: string, patch: ObservedRequest, create = false) => {
  if (!getState().settings.enabled || (!create && !store.get(requestId))) return undefined;
  const record = { ...(store.get(requestId) || {}), ...patch, requestId, source: "webRequest" };
  store.put(requestId, record);
  observers.forEach((observer) => observer(record));
  return undefined;
};

chrome.webRequest?.onBeforeRequest?.addListener((details) => update(details.requestId, {
  url: boundedNetworkText(details.url, NETWORK_URL_MAX_BYTES),
  method: boundedNetworkText(details.method, NETWORK_TOKEN_MAX_BYTES),
  tabId: details.tabId,
  frameId: details.frameId,
  parentFrameId: details.parentFrameId,
  type: boundedNetworkText(details.type, NETWORK_TOKEN_MAX_BYTES),
  timeStamp: details.timeStamp,
  phase: "request",
  ...(details.initiator && { initiator: boundedNetworkText(details.initiator, NETWORK_URL_MAX_BYTES) }),
  ...(details.documentId && { documentId: boundedNetworkText(details.documentId, NETWORK_TOKEN_MAX_BYTES) }),
}, true), filter);

chrome.webRequest?.onBeforeSendHeaders?.addListener((details) => update(details.requestId, {
  requestHeaders: boundedHeaderList(details.requestHeaders),
  phase: "requestHeaders",
}), filter, ["requestHeaders", "extraHeaders"]);

chrome.webRequest?.onHeadersReceived?.addListener((details) => update(details.requestId, {
  statusCode: details.statusCode,
  statusLine: boundedNetworkText(details.statusLine, NETWORK_TEXT_MAX_BYTES),
  responseHeaders: boundedHeaderList(details.responseHeaders),
  phase: "responseHeaders",
}), filter, ["responseHeaders", "extraHeaders"]);

chrome.webRequest?.onBeforeRedirect?.addListener((details) => {
  const current = store.get(details.requestId)?.redirectChain;
  const redirect = {
    from: boundedNetworkText(details.url, NETWORK_URL_MAX_BYTES),
    to: boundedNetworkText(details.redirectUrl, NETWORK_URL_MAX_BYTES),
    statusCode: details.statusCode,
    timeStamp: details.timeStamp,
  };
  return update(details.requestId, {
    redirectUrl: boundedNetworkText(details.redirectUrl, NETWORK_URL_MAX_BYTES),
    redirectChain: redirectChain(current, redirect),
    statusCode: details.statusCode,
    responseHeaders: boundedHeaderList(details.responseHeaders),
    phase: "redirect",
  });
}, filter, ["responseHeaders", "extraHeaders"]);

chrome.webRequest?.onCompleted?.addListener((details) => update(details.requestId, {
  statusCode: details.statusCode,
  fromCache: details.fromCache,
  ip: details.ip ? boundedNetworkText(details.ip, NETWORK_TOKEN_MAX_BYTES) : null,
  completedAt: details.timeStamp,
  phase: "completed",
}), filter, ["responseHeaders", "extraHeaders"]);

chrome.webRequest?.onErrorOccurred?.addListener((details) => update(details.requestId, {
  error: boundedNetworkText(details.error, NETWORK_ERROR_MAX_BYTES),
  completedAt: details.timeStamp,
  phase: "error",
}), filter);

export const getObservedRequest = (requestId: string) => store.get(requestId);
export const listObservedRequests = () => store.list();
export const observedRequestStats = () => store.stats();
export const clearObservedRequests = () => store.clear();

export const subscribeObservedRequests = (observer: Observer) => {
  observers.add(observer);
  return () => { observers.delete(observer); };
};
