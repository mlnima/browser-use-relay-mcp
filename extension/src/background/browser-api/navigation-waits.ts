import type { BrowserApiHandler } from "./types.js";
import { waitForNavigation } from "./navigation-event-wait.js";
import { waitForUrl } from "./url-wait.js";

export const handleNavigationWaitAction: BrowserApiHandler = async (request, signal) => {
  if (request.action === "waitURL") return waitForUrl(request, signal);
  if (request.action === "waitNavigation") return waitForNavigation(request, signal);
  return undefined;
};
