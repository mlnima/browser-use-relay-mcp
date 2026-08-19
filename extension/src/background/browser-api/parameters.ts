import type { ActionRequest } from "../../../../src/types/action.js";
import type { JsonValue } from "../../../../src/types/json.js";
import { apiCapability, assertActionCapability } from "./capability.js";

export const paramsOf = (request: ActionRequest): Record<string, JsonValue> =>
  request.params || {};

export type TabIdSelection = number | [number, ...number[]];

export const tabIdArray = (selection: TabIdSelection): number[] =>
  typeof selection === "number" ? [selection] : selection;

export const resolveTabId = async (request: ActionRequest): Promise<number> => {
  const supplied = request.target?.tabId ?? request.params?.tabId;
  if (typeof supplied === "number") return supplied;
  assertActionCapability(apiCapability(chrome.tabs, "query", "chrome.tabs.query"));
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (typeof tab?.id !== "number") throw new Error("No active tab is available.");
  return tab.id;
};

export const resolveTabIds = async (request: ActionRequest): Promise<TabIdSelection> => {
  const supplied = request.params?.tabIds;
  if (Array.isArray(supplied)) {
    if (supplied.length === 0) throw new Error("At least one tab ID is required.");
    return supplied.length === 1
      ? supplied[0] as number
      : supplied as [number, ...number[]];
  }
  return resolveTabId(request);
};

export const resolveWindowId = async (request: ActionRequest): Promise<number> => {
  const supplied = request.params?.windowId;
  if (typeof supplied === "number") return supplied;
  if (typeof request.target?.tabId === "number") {
    assertActionCapability(apiCapability(chrome.tabs, "get", "chrome.tabs.get"));
    return (await chrome.tabs.get(request.target.tabId)).windowId;
  }
  assertActionCapability(apiCapability(chrome.windows, "getLastFocused", "chrome.windows.getLastFocused"));
  const window = await chrome.windows.getLastFocused();
  if (typeof window.id !== "number") throw new Error("No browser window is available.");
  return window.id;
};
