import type { JsonValue } from "../../../../src/types/json.js";
import { MAX_BROWSER_JSON_BYTES } from "../../../../src/protocol/limits.js";
import { jsonFitsByteLimit } from "../native/json-byte-limit.js";
import { jsonValueFitsLimits } from "../native/json-value-limit.js";

export const toJson = (value: unknown): JsonValue => {
  if (value === undefined) return null;
  if (!jsonFitsByteLimit(value, MAX_BROWSER_JSON_BYTES)) throw new Error("BROWSER_RESULT_TOO_LARGE");
  const seen = new WeakSet<object>();
  const serialized = JSON.stringify(value, (_key, current: unknown) => {
    if (typeof current === "bigint") return current.toString();
    if (current instanceof ArrayBuffer) return [...new Uint8Array(current)];
    if (ArrayBuffer.isView(current)) {
      return [...new Uint8Array(current.buffer, current.byteOffset, current.byteLength)];
    }
    if (current instanceof Map) return Object.fromEntries(current);
    if (current instanceof Set) return [...current];
    if (current instanceof Error) return { name: current.name, message: current.message, stack: current.stack };
    if (typeof current !== "object" || current === null) return current;
    if (seen.has(current)) return "[Circular]";
    seen.add(current);
    return current;
  });
  const output = serialized === undefined ? null : JSON.parse(serialized) as JsonValue;
  if (!jsonValueFitsLimits(output)) throw new Error("BROWSER_RESULT_STRUCTURE_TOO_LARGE");
  return output;
};

export const completed = (): JsonValue => true;
