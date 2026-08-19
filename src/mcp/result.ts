import type { ActionResult } from "../types/action.js";
import type { JsonValue } from "../types/json.js";
import { MAX_DUPLICATED_MCP_RESULT_CHARACTERS } from "../protocol/limits.js";

export const resultContent = (data: JsonValue) => {
  const text = JSON.stringify(data);
  const content = [{ type: "text" as const, text }];
  return text.length <= MAX_DUPLICATED_MCP_RESULT_CHARACTERS ? { content, structuredContent: data } : { content };
};

export const actionResultContent = (result: ActionResult) => ({
  ...resultContent(result as unknown as JsonValue),
  isError: !result.success,
});
