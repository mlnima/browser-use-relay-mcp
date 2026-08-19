import type { BrowserApiHandler } from "./types.js";
import { apiCapability, assertActionCapability } from "./capability.js";
import { completed, toJson } from "./json.js";
import { paramsOf, resolveTabId, resolveTabIds, tabIdArray } from "./parameters.js";
import { closeTabsSafely } from "./tab-close.js";

const activeTab = async () => {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab) throw new Error("No active tab is available.");
  return tab;
};

const setZoom = async (tabId: number, value: number) => {
  await chrome.tabs.setZoom(tabId, value);
  return value;
};

export const handleTabAction: BrowserApiHandler = async (request) => {
  const params = paramsOf(request);
  switch (request.action) {
    case "listTabs":
      return toJson(await chrome.tabs.query((params.query || params) as chrome.tabs.QueryInfo));
    case "getActiveTab":
      return toJson(await activeTab());
    case "newTab":
      return toJson(await chrome.tabs.create(params as chrome.tabs.CreateProperties));
    case "closeTab":
      return closeTabsSafely(await resolveTabIds(request));
    case "activateTab":
      return toJson(await chrome.tabs.update(await resolveTabId(request), { active: true }));
    case "switchTab": {
      const tab = await chrome.tabs.update(await resolveTabId(request), { active: true });
      if (typeof tab?.windowId === "number") await chrome.windows.update(tab.windowId, { focused: true });
      return toJson(tab);
    }
    case "navigateTab":
      return toJson(await chrome.tabs.update(await resolveTabId(request), { url: params.url as string }));
    case "reloadTab":
      await chrome.tabs.reload(await resolveTabId(request), { bypassCache: params.bypassCache === true });
      return completed();
    case "duplicateTab":
      return toJson(await chrome.tabs.duplicate(await resolveTabId(request)));
    case "moveTab": {
      const tabIds = tabIdArray(await resolveTabIds(request));
      return toJson(await chrome.tabs.move(tabIds, {
        index: params.index as number,
        ...(typeof params.windowId === "number" && { windowId: params.windowId }),
      }));
    }
    case "pinTab":
      return toJson(await chrome.tabs.update(await resolveTabId(request), { pinned: true }));
    case "unpinTab":
      return toJson(await chrome.tabs.update(await resolveTabId(request), { pinned: false }));
    case "groupTabs": {
      const groupId = await (chrome.tabs.group({
        tabIds: await resolveTabIds(request),
        ...(typeof params.groupId === "number" ? { groupId: params.groupId } : {}),
        ...(typeof params.windowId === "number" ? { createProperties: { windowId: params.windowId } } : {}),
      }) as unknown as Promise<number>);
      const update = params.group as chrome.tabGroups.UpdateProperties | undefined;
      if (update) assertActionCapability(apiCapability(chrome.tabGroups, "update", "chrome.tabGroups.update"));
      return toJson(update ? await chrome.tabGroups.update(groupId, update) : { groupId });
    }
    case "ungroupTabs":
      await chrome.tabs.ungroup(await resolveTabIds(request));
      return completed();
    case "muteTab":
      return toJson(await chrome.tabs.update(await resolveTabId(request), { muted: true }));
    case "unmuteTab":
      return toJson(await chrome.tabs.update(await resolveTabId(request), { muted: false }));
    case "zoomIn": {
      const id = await resolveTabId(request);
      return setZoom(id, await chrome.tabs.getZoom(id) + (typeof params.step === "number" ? params.step : 0.1));
    }
    case "zoomOut": {
      const id = await resolveTabId(request);
      return setZoom(id, await chrome.tabs.getZoom(id) - (typeof params.step === "number" ? params.step : 0.1));
    }
    case "resetZoom":
      return setZoom(await resolveTabId(request), 0);
    default:
      return undefined;
  }
};
