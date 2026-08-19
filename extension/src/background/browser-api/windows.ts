import type { BrowserApiHandler } from "./types.js";
import { toJson } from "./json.js";
import { paramsOf, resolveTabIds, resolveWindowId, tabIdArray } from "./parameters.js";
import { closeWindowSafely } from "./tab-close.js";

export const handleWindowAction: BrowserApiHandler = async (request) => {
  const params = paramsOf(request);
  switch (request.action) {
    case "listWindows":
      return toJson(await chrome.windows.getAll({
        populate: params.populate !== false,
        ...(Array.isArray(params.windowTypes) && { windowTypes: params.windowTypes as chrome.windows.WindowType[] }),
      }));
    case "createWindow":
      return toJson(await chrome.windows.create(params as chrome.windows.CreateData));
    case "closeWindow":
      return closeWindowSafely(await resolveWindowId(request));
    case "focusWindow":
      return toJson(await chrome.windows.update(await resolveWindowId(request), { focused: true }));
    case "resizeWindow":
      return toJson(await chrome.windows.update(await resolveWindowId(request), {
        width: params.width as number,
        height: params.height as number,
      }));
    case "repositionWindow":
      return toJson(await chrome.windows.update(await resolveWindowId(request), {
        left: params.left as number,
        top: params.top as number,
      }));
    case "minimizeWindow":
      return toJson(await chrome.windows.update(await resolveWindowId(request), { state: "minimized" }));
    case "maximizeWindow":
      return toJson(await chrome.windows.update(await resolveWindowId(request), { state: "maximized" }));
    case "restoreWindow":
      return toJson(await chrome.windows.update(await resolveWindowId(request), { state: "normal" }));
    case "fullscreenWindow":
      return toJson(await chrome.windows.update(await resolveWindowId(request), { state: "fullscreen" }));
    case "moveTabToWindow": {
      const tabIds = tabIdArray(await resolveTabIds(request));
      return toJson(await chrome.tabs.move(tabIds, {
        windowId: await resolveWindowId(request),
        index: typeof params.index === "number" ? params.index : -1,
      }));
    }
    default:
      return undefined;
  }
};
