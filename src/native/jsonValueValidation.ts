import type { JsonValue } from "../types/json.js";
import { MAX_JSON_VALUE_DEPTH, MAX_JSON_VALUE_NODES } from "../protocol/limits.js";

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(
  value && typeof value === "object" && !Array.isArray(value),
);

export const isJsonValue = (value: unknown): value is JsonValue => {
  const pending = [{ value, depth: 0 }];
  const seen = new WeakSet<object>();
  let nodes = 0;
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
    if (!Array.isArray(item) && !isRecord(item)) return false;
    if (seen.has(item)) return false;
    seen.add(item);
    if (Array.isArray(item)) {
      for (let index = item.length - 1; index >= 0; index -= 1) pending.push({ value: item[index], depth: current.depth + 1 });
    } else {
      for (const key in item) if (Object.hasOwn(item, key)) pending.push({ value: item[key], depth: current.depth + 1 });
    }
  }
  return true;
};

export const isObjectRecord = isRecord;
