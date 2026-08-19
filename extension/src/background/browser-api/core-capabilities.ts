import type { ActionCapability } from "./capability.js";
import { apiCapability, combinedCapability } from "./capability.js";

const tabs = chrome.tabs;
const windows = chrome.windows;
const navigation = chrome.webNavigation;
const scripting = chrome.scripting;

const capabilities: Record<string, ActionCapability> = {
  listTabs: apiCapability(tabs, "query", "chrome.tabs.query"),
  getActiveTab: apiCapability(tabs, "query", "chrome.tabs.query"),
  newTab: apiCapability(tabs, "create", "chrome.tabs.create"),
  closeTab: combinedCapability("chrome.tabs.query and chrome.tabs.remove", tabs?.query, tabs?.remove),
  closeWindow: combinedCapability("chrome.tabs.query and chrome.windows.remove", tabs?.query, windows?.remove),
  activateTab: apiCapability(tabs, "update", "chrome.tabs.update"),
  switchTab: combinedCapability("chrome.tabs.query, chrome.tabs.update, and chrome.windows.update", tabs?.query, tabs?.update, windows?.update),
  navigateTab: apiCapability(tabs, "update", "chrome.tabs.update"),
  reloadTab: apiCapability(tabs, "reload", "chrome.tabs.reload"),
  duplicateTab: apiCapability(tabs, "duplicate", "chrome.tabs.duplicate"),
  moveTab: apiCapability(tabs, "move", "chrome.tabs.move"),
  pinTab: apiCapability(tabs, "update", "chrome.tabs.update"),
  unpinTab: apiCapability(tabs, "update", "chrome.tabs.update"),
  groupTabs: apiCapability(tabs, "group", "chrome.tabs.group"),
  ungroupTabs: apiCapability(tabs, "ungroup", "chrome.tabs.ungroup"),
  muteTab: apiCapability(tabs, "update", "chrome.tabs.update"),
  unmuteTab: apiCapability(tabs, "update", "chrome.tabs.update"),
  zoomIn: combinedCapability("chrome.tabs.getZoom and chrome.tabs.setZoom", tabs?.getZoom, tabs?.setZoom),
  zoomOut: combinedCapability("chrome.tabs.getZoom and chrome.tabs.setZoom", tabs?.getZoom, tabs?.setZoom),
  resetZoom: apiCapability(tabs, "setZoom", "chrome.tabs.setZoom"),
  goto: apiCapability(tabs, "update", "chrome.tabs.update"),
  back: apiCapability(tabs, "goBack", "chrome.tabs.goBack"),
  forward: apiCapability(tabs, "goForward", "chrome.tabs.goForward"),
  reload: apiCapability(tabs, "reload", "chrome.tabs.reload"),
  hardReload: apiCapability(tabs, "reload", "chrome.tabs.reload"),
  getNavigationState: combinedCapability("chrome.tabs.get and chrome.webNavigation.getAllFrames", tabs?.get, navigation?.getAllFrames),
  waitURL: apiCapability(tabs, "onUpdated", "chrome.tabs.onUpdated"),
  waitNavigation: combinedCapability("Chrome webNavigation lifecycle and SPA events", navigation?.onCommitted, navigation?.onDOMContentLoaded, navigation?.onCompleted, navigation?.onErrorOccurred, navigation?.onHistoryStateUpdated, navigation?.onReferenceFragmentUpdated),
  listFrames: apiCapability(navigation, "getAllFrames", "chrome.webNavigation.getAllFrames"),
  executeInFrame: apiCapability(scripting, "executeScript", "chrome.scripting.executeScript"),
  executeInAllFrames: apiCapability(scripting, "executeScript", "chrome.scripting.executeScript"),
  waitFrame: combinedCapability("chrome.webNavigation.getAllFrames and onCommitted", navigation?.getAllFrames, navigation?.onCommitted),
  captureVisibleTab: combinedCapability("chrome.tabs query, update, get, and captureVisibleTab", tabs?.query, tabs?.update, tabs?.get, tabs?.captureVisibleTab),
  captureViewport: combinedCapability("chrome.tabs query, update, get, and captureVisibleTab", tabs?.query, tabs?.update, tabs?.get, tabs?.captureVisibleTab),
  captureElement: combinedCapability("chrome.tabs capture APIs and chrome.scripting.executeScript", tabs?.query, tabs?.update, tabs?.get, tabs?.captureVisibleTab, scripting?.executeScript),
  injectCSS: apiCapability(scripting, "insertCSS", "chrome.scripting.insertCSS"),
  removeInjectedCSS: apiCapability(scripting, "removeCSS", "chrome.scripting.removeCSS"),
  moveTabToWindow: combinedCapability("chrome.tabs.move and chrome.windows.getLastFocused", tabs?.move, windows?.getLastFocused),
};

const windowMethods: Record<string, string> = {
  listWindows: "getAll", createWindow: "create", closeWindow: "remove",
  focusWindow: "update", resizeWindow: "update", repositionWindow: "update",
  minimizeWindow: "update", maximizeWindow: "update", restoreWindow: "update",
  fullscreenWindow: "update",
};

export const getCoreCapability = (action: string): ActionCapability | undefined => {
  const windowMethod = windowMethods[action];
  return capabilities[action] || (windowMethod ? apiCapability(windows, windowMethod, `chrome.windows.${windowMethod}`) : undefined);
};

export const listCoreCapabilities = () => [
  ...Object.entries(capabilities),
  ...Object.entries(windowMethods).filter(([action]) => !capabilities[action]).map(([action, method]) => [action, apiCapability(windows, method, `chrome.windows.${method}`)] as const),
].map(([action, [api, available]]) => ({ action, api, available }));
