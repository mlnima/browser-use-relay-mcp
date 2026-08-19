import type { ActionRequest } from "../../../../src/types/action.js";
import type { JsonValue } from "../../../../src/types/json.js";

export type BrowserApiHandler = (
  request: ActionRequest,
  signal?: AbortSignal,
) => Promise<JsonValue | undefined>;
