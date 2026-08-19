import type { ActionRequest } from "../../../../src/types/action.js";
import type { JsonValue } from "../../../../src/types/json.js";
import type { BrowserApiHandler } from "./types.js";
import { assertActionCapability } from "./capability.js";
import { handleBrowserDataAction } from "./browser-data.js";
import { handleBrowsingDataAction } from "./browsing-data.js";
import { handleCookieAction } from "./cookies.js";
import { handleClipboardAction } from "./clipboard.js";
import { handleCssAction } from "./css.js";
import { handleDownloadAction } from "./downloads.js";
import { handleDownloadWaitAction } from "./download-wait.js";
import { handleExtensionStorageAction } from "./extension-storage.js";
import { handleFrameAction } from "./frames.js";
import { handleFrameWaitAction } from "./frame-wait.js";
import { handleNavigationAction } from "./navigation.js";
import { handleNavigationWaitAction } from "./navigation-waits.js";
import { handleNetworkAction } from "./network.js";
import { handleNetworkWaitAction } from "./network-wait.js";
import { getCoreCapability } from "./core-capabilities.js";
import { getDataCapability } from "./data-capabilities.js";
import { handleReadingListAction } from "./reading-list.js";
import { handleScreenshotAction } from "./screenshots.js";
import { handleSiteStorageAction } from "./site-storage.js";
import { handleTabAction } from "./tabs.js";
import { handleTabCaptureAction } from "./tab-capture/actions.js";
import { handleWindowAction } from "./windows.js";
import { handleRuntimeCapabilitiesAction } from "./runtime-capabilities.js";

const handlers: readonly BrowserApiHandler[] = [
  handleRuntimeCapabilitiesAction,
  handleTabAction,
  handleNavigationAction,
  handleWindowAction,
  handleFrameAction,
  handleDownloadAction,
  handleTabCaptureAction,
  handleCookieAction,
  handleClipboardAction,
  handleCssAction,
  handleExtensionStorageAction,
  handleSiteStorageAction,
  handleBrowsingDataAction,
  handleBrowserDataAction,
  handleReadingListAction,
  handleNetworkAction,
  handleScreenshotAction,
  handleNavigationWaitAction,
  handleFrameWaitAction,
  handleNetworkWaitAction,
  handleDownloadWaitAction,
];

export const executeBrowserApiAction = async (
  request: ActionRequest,
  signal?: AbortSignal,
): Promise<JsonValue | undefined> => {
  assertActionCapability(getCoreCapability(request.action) || getDataCapability(request.action));
  for (const handler of handlers) {
    signal?.throwIfAborted();
    const result = await handler(request, signal);
    if (result !== undefined) return result;
  }
  return undefined;
};
