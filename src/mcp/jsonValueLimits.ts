import { MAX_JSON_VALUE_DEPTH, MAX_JSON_VALUE_NODES } from "../protocol/limits.js";
import type { JsonValue } from "../types/json.js";

export const isJsonObject = (value: unknown): value is Record<string, JsonValue> => Boolean(
  value && typeof value === "object" && !Array.isArray(value),
);

export const jsonValueFitsLimits = (value: unknown): value is JsonValue => {
  const pending = [{ value, depth: 0 }];
  const seen = new WeakSet<object>();
  let nodes = 0; let scheduled = 1;
  while (pending.length) {
    const current = pending.pop()!;
    nodes += 1;
    if (nodes > MAX_JSON_VALUE_NODES || current.depth > MAX_JSON_VALUE_DEPTH) return false;
    const item = current.value;
    if (item === null || typeof item === "string" || typeof item === "boolean") continue;
    if (typeof item === "number") {
      if (!Number.isFinite(item)) return false;
      continue;
    }
    if (!item || typeof item !== "object" || seen.has(item)) return false;
    seen.add(item);
    if (Array.isArray(item)) {
      if (item.length && current.depth >= MAX_JSON_VALUE_DEPTH || scheduled + item.length > MAX_JSON_VALUE_NODES) return false;
      scheduled += item.length;
      for (let index = item.length - 1; index >= 0; index -= 1)
        pending.push({ value: item[index], depth: current.depth + 1 });
    } else {
      for (const key in item) if (Object.hasOwn(item, key)) {
        scheduled += 1;
        if (current.depth >= MAX_JSON_VALUE_DEPTH || scheduled > MAX_JSON_VALUE_NODES) return false;
        pending.push({ value: (item as Record<string, unknown>)[key], depth: current.depth + 1 });
      }
    }
  }
  return true;
};
