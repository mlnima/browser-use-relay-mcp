import type { ActionRequest } from "../../../../src/types/action.js";
import type { JsonValue } from "../../../../src/types/json.js";

export type ContentActionContext = {
  request: ActionRequest;
  target?: Element;
  resolveTarget: () => Element | undefined;
  signal: AbortSignal;
};

export type ContentActionHandler = (context: ContentActionContext) => Promise<JsonValue>;
