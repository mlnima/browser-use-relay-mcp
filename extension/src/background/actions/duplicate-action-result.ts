import type { ActionRequest, ActionResult } from "../../../../src/types/action.js";

export const duplicateActionResult = (request: ActionRequest): ActionResult => ({
  id: request.id,
  success: false,
  engine: request.engine === "native" ? "native" : "browser",
  error: { code: "DUPLICATE_ACTION_ID", message: `Action id "${request.id}" is already active.`, retryable: true },
  durationMs: 0,
});
