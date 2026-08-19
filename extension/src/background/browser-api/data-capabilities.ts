import type { ActionCapability } from "./capability.js";
import { apiCapability, combinedCapability } from "./capability.js";

const extensionApis = chrome as unknown as { readingList?: Record<string, unknown> };
const captureApis = chrome as unknown as {
  tabCapture?: Record<string, unknown>;
  offscreen?: Record<string, unknown>;
};

const capabilities: Record<string, ActionCapability> = {
  startDownload: apiCapability(chrome.downloads, "download", "chrome.downloads.download"),
  listDownloads: apiCapability(chrome.downloads, "search", "chrome.downloads.search"),
  pauseDownload: apiCapability(chrome.downloads, "pause", "chrome.downloads.pause"),
  resumeDownload: apiCapability(chrome.downloads, "resume", "chrome.downloads.resume"),
  cancelDownload: apiCapability(chrome.downloads, "cancel", "chrome.downloads.cancel"),
  removeDownloadedFile: apiCapability(chrome.downloads, "removeFile", "chrome.downloads.removeFile"),
  eraseDownload: apiCapability(chrome.downloads, "erase", "chrome.downloads.erase"),
  openDownload: apiCapability(chrome.downloads, "search", "chrome.downloads.search when resolving downloadId"),
  revealDownload: apiCapability(chrome.downloads, "search", "chrome.downloads.search when resolving downloadId"),
  waitDownload: combinedCapability("chrome.downloads.search and onChanged", chrome.downloads?.search, chrome.downloads?.onChanged),
  startTabCapture: combinedCapability("Chromium tab capture and offscreen APIs", captureApis.tabCapture?.getMediaStreamId, captureApis.offscreen?.createDocument, chrome.runtime?.getContexts),
  stopTabCapture: combinedCapability("Chromium offscreen and downloads APIs", chrome.runtime?.getContexts, chrome.downloads?.download, chrome.storage?.session),
  readClipboard: combinedCapability("Chromium offscreen clipboard APIs", captureApis.offscreen?.createDocument, chrome.runtime?.getContexts),
  writeClipboard: combinedCapability("Chromium offscreen clipboard APIs", captureApis.offscreen?.createDocument, chrome.runtime?.getContexts),
  listCookies: apiCapability(chrome.cookies, "getAll", "chrome.cookies.getAll"),
  getCookie: apiCapability(chrome.cookies, "get", "chrome.cookies.get"),
  setCookie: apiCapability(chrome.cookies, "set", "chrome.cookies.set"),
  deleteCookie: apiCapability(chrome.cookies, "remove", "chrome.cookies.remove"),
  readExtensionStorage: ["chrome.storage", Boolean(chrome.storage)],
  writeExtensionStorage: ["chrome.storage", Boolean(chrome.storage)],
  clearSiteData: apiCapability(chrome.browsingData, "remove", "chrome.browsingData.remove"),
  clearBrowsingData: apiCapability(chrome.browsingData, "remove", "chrome.browsingData.remove"),
  queryHistory: apiCapability(chrome.history, "search", "chrome.history.search"),
  deleteHistory: combinedCapability("chrome.history deletion APIs", chrome.history?.deleteUrl, chrome.history?.deleteRange, chrome.history?.deleteAll),
  listBookmarks: combinedCapability("chrome.bookmarks listing APIs", chrome.bookmarks?.search, chrome.bookmarks?.getChildren, chrome.bookmarks?.getSubTree, chrome.bookmarks?.getTree),
  createBookmark: apiCapability(chrome.bookmarks, "create", "chrome.bookmarks.create"),
  updateBookmark: apiCapability(chrome.bookmarks, "update", "chrome.bookmarks.update"),
  deleteBookmark: combinedCapability("chrome.bookmarks.remove and removeTree", chrome.bookmarks?.remove, chrome.bookmarks?.removeTree),
  listSessions: apiCapability(chrome.sessions, "getRecentlyClosed", "chrome.sessions.getRecentlyClosed"),
  restoreSession: apiCapability(chrome.sessions, "restore", "chrome.sessions.restore"),
  inspectIndexedDB: apiCapability(chrome.scripting, "executeScript", "chrome.scripting.executeScript"),
  enableResponseBodyCapture: combinedCapability("chrome.debugger attach and command APIs", chrome.debugger?.attach, chrome.debugger?.sendCommand),
  listRequests: apiCapability(chrome.webRequest, "onBeforeRequest", "chrome.webRequest"),
  getRequest: apiCapability(chrome.webRequest, "onBeforeRequest", "chrome.webRequest"),
  waitRequest: apiCapability(chrome.webRequest, "onBeforeRequest", "chrome.webRequest"),
  waitResponse: apiCapability(chrome.webRequest, "onHeadersReceived", "chrome.webRequest"),
  setNetworkRules: combinedCapability("chrome.declarativeNetRequest rule APIs", chrome.declarativeNetRequest?.getDynamicRules, chrome.declarativeNetRequest?.updateDynamicRules, chrome.declarativeNetRequest?.getSessionRules, chrome.declarativeNetRequest?.updateSessionRules),
  clearNetworkRules: combinedCapability("chrome.declarativeNetRequest rule APIs", chrome.declarativeNetRequest?.getDynamicRules, chrome.declarativeNetRequest?.updateDynamicRules, chrome.declarativeNetRequest?.getSessionRules, chrome.declarativeNetRequest?.updateSessionRules),
  fetch: ["fetch", typeof globalThis.fetch === "function"],
  listReadingList: apiCapability(extensionApis.readingList, "query", "chrome.readingList.query"),
  addReadingListEntry: apiCapability(extensionApis.readingList, "addEntry", "chrome.readingList.addEntry"),
  updateReadingListEntry: apiCapability(extensionApis.readingList, "updateEntry", "chrome.readingList.updateEntry"),
  removeReadingListEntry: apiCapability(extensionApis.readingList, "removeEntry", "chrome.readingList.removeEntry"),
};

export const getDataCapability = (action: string) => capabilities[action];

export const listDataCapabilities = () => Object.entries(capabilities)
  .map(([action, [api, available]]) => ({ action, api, available }));
