import type { ActionResult } from "../types/action.js";
import type { JsonValue } from "../types/json.js";
import { MAX_MCP_TEXT_RESULT_BYTES } from "../protocol/limits.js";

const byteLength = (value: string) => Buffer.byteLength(value, "utf8");

const boundedJsonText = (data: JsonValue) => {
  const serialized = JSON.stringify(data);
  const originalBytes = byteLength(serialized);
  if (originalBytes <= MAX_MCP_TEXT_RESULT_BYTES) return serialized;
  let low = 0;
  let high = Math.min(serialized.length, MAX_MCP_TEXT_RESULT_BYTES);
  let accepted = JSON.stringify({ truncated: true, originalBytes, byteLimit: MAX_MCP_TEXT_RESULT_BYTES });
  while (low <= high) {
    const retained = Math.floor((low + high) / 2);
    const headLength = Math.ceil(retained * 0.75);
    const candidate = JSON.stringify({
      truncated: true,
      originalBytes,
      byteLimit: MAX_MCP_TEXT_RESULT_BYTES,
      head: serialized.slice(0, headLength),
      tail: serialized.slice(-Math.max(0, retained - headLength)),
    });
    if (byteLength(candidate) <= MAX_MCP_TEXT_RESULT_BYTES) {
      accepted = candidate;
      low = retained + 1;
    } else high = retained - 1;
  }
  return accepted;
};

export const resultContent = (data: JsonValue) => {
  const text = boundedJsonText(data);
  return { content: [{ type: "text" as const, text }] };
};

export const structuredResultContent = (data: JsonValue) => ({
  ...resultContent(data),
  structuredContent: data,
});

export const actionResultContent = (result: ActionResult) => ({
  ...resultContent(result as unknown as JsonValue),
  isError: !result.success,
});
