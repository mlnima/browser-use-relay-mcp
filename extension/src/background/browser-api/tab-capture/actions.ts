import type { BrowserApiHandler } from "../types.js";
import { startCaptureAction } from "./start-action.js";
import { stopCaptureAction } from "./stop-action.js";

export const handleTabCaptureAction: BrowserApiHandler = async (request, signal) => {
  if (request.action === "startTabCapture") return startCaptureAction(request, signal);
  if (request.action === "stopTabCapture") return stopCaptureAction(request, signal);
  return undefined;
};
