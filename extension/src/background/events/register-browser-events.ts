import type { JsonValue } from "../../../../src/types/json.js";

type Publish = (name: string, data: JsonValue) => void;

export const registerBrowserEvents = (publish: Publish) => {
  chrome.tabs.onCreated.addListener((tab) => publish("tab.created", { id: tab.id ?? null, windowId: tab.windowId, url: tab.pendingUrl || tab.url || null }));
  chrome.tabs.onRemoved.addListener((tabId, info) => publish("tab.removed", { tabId, windowId: info.windowId, isWindowClosing: info.isWindowClosing }));
  chrome.tabs.onActivated.addListener((info) => publish("tab.activated", info as unknown as JsonValue));
  chrome.tabs.onUpdated.addListener((tabId, change, tab) => publish("tab.updated", {
    tabId,
    status: change.status || null,
    url: change.url || null,
    title: change.title || null,
    windowId: tab.windowId,
  }));
  chrome.webNavigation.onBeforeNavigate.addListener((details) => publish("navigation.before", details as unknown as JsonValue));
  chrome.webNavigation.onCommitted.addListener((details) => publish("navigation.committed", details as unknown as JsonValue));
  chrome.webNavigation.onDOMContentLoaded.addListener((details) => publish("navigation.domReady", details as unknown as JsonValue));
  chrome.webNavigation.onCompleted.addListener((details) => publish("navigation.completed", details as unknown as JsonValue));
  chrome.webNavigation.onErrorOccurred.addListener((details) => publish("navigation.error", details as unknown as JsonValue));
  chrome.webNavigation.onHistoryStateUpdated.addListener((details) => publish("navigation.historyState", details as unknown as JsonValue));
  chrome.webNavigation.onReferenceFragmentUpdated.addListener((details) => publish("navigation.fragment", details as unknown as JsonValue));
  chrome.downloads.onCreated.addListener((item) => publish("download.created", item as unknown as JsonValue));
  chrome.downloads.onChanged.addListener((delta) => publish("download.changed", delta as unknown as JsonValue));
  chrome.webRequest.onBeforeRequest.addListener((details) => {
    publish("request.started", {
    requestId: details.requestId,
    tabId: details.tabId,
    frameId: details.frameId,
    parentFrameId: details.parentFrameId,
    method: details.method,
    type: details.type,
    url: details.url,
    timeStamp: details.timeStamp,
    });
    return undefined;
  }, { urls: ["<all_urls>"] });
  chrome.webRequest.onCompleted.addListener((details) => publish("request.completed", {
    requestId: details.requestId,
    tabId: details.tabId,
    frameId: details.frameId,
    method: details.method,
    type: details.type,
    url: details.url,
    statusCode: details.statusCode,
    fromCache: details.fromCache,
    timeStamp: details.timeStamp,
  }), { urls: ["<all_urls>"] });
  chrome.webRequest.onErrorOccurred.addListener((details) => publish("request.failed", {
    requestId: details.requestId,
    tabId: details.tabId,
    frameId: details.frameId,
    method: details.method,
    type: details.type,
    url: details.url,
    error: details.error,
    timeStamp: details.timeStamp,
  }), { urls: ["<all_urls>"] });
};
