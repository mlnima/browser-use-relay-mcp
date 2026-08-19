import type { ActionRequest, ActionResult } from "../types/action.js";
import { getActionDefinition } from "../protocol/actionCatalog.js";
import { boundedActionError } from "../protocol/actionError.js";

export const resultEngine = (request: ActionRequest): "browser" | "dom" | "native" =>
  request.engine && request.engine !== "auto"
    ? request.engine
    : getActionDefinition(request.action)?.engines[0] || "browser";

export const failedActionResult = (
  request: ActionRequest,
  code: string,
  message: string,
  durationMs = 0,
  retryable = false,
): ActionResult => ({
  id: request.id,
  success: false,
  engine: resultEngine(request),
  error: boundedActionError({ code, message, retryable }),
  durationMs,
});
