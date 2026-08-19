import { jsonStringPartsBytesWithin, MAX_CONTENT_JSON_DEPTH, MAX_CONTENT_JSON_ITEMS, MAX_CONTENT_VALUE_BYTES } from "../../../../src/protocol/limits.js";
import type { JsonValue } from "../../../../src/types/json.js";
export const requireElement = (target?: Element) => {
  if (!target?.isConnected) throw new Error("The target element is missing or stale.");
  return target;
};
export const requireHtmlElement = (target?: Element) => {
  const element = requireElement(target);
  if (!(element instanceof HTMLElement)) throw new Error("The target is not an HTML element.");
  return element;
};
export const requireInput = (target?: Element) => {
  const element = requireElement(target);
  if (!(element instanceof HTMLInputElement)) throw new Error("The target is not an input.");
  return element;
};
export const dispatchValueEvents = (element: Element, inputType = "insertText") => {
  element.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType }));
  element.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
};
type Budget = { bytes: number; maximum: number; label: string; seen: WeakSet<object> };
const skipped = Symbol("skipped");
type Converted = JsonValue | typeof skipped;
const fail = (budget: Budget, detail: string): never => {
  throw Object.assign(new Error(`${budget.label} exceeds the ${detail}.`), { contentCode: "CONTENT_RESULT_TOO_LARGE" });
};
const add = (budget: Budget, bytes: number) => {
  budget.bytes += bytes;
  if (budget.bytes > budget.maximum) fail(budget, `${budget.maximum}-byte limit`);
};
const addString = (budget: Budget, value: string) => {
  const bytes = jsonStringPartsBytesWithin([value], budget.maximum - budget.bytes);
  add(budget, bytes ?? fail(budget, `${budget.maximum}-byte limit`));
};
const convertBytes = (bytes: Uint8Array, budget: Budget): JsonValue => {
  if (bytes.length > MAX_CONTENT_JSON_ITEMS) fail(budget, `${MAX_CONTENT_JSON_ITEMS}-item limit`);
  const output: number[] = [];
  add(budget, 2);
  for (let index = 0; index < bytes.length; index += 1) {
    index > 0 && add(budget, 1);
    add(budget, String(bytes[index]).length);
    output.push(bytes[index]);
  }
  return output;
};
const convert = (value: unknown, budget: Budget, depth: number): Converted => {
  if (depth > MAX_CONTENT_JSON_DEPTH) fail(budget, `${MAX_CONTENT_JSON_DEPTH}-level depth limit`);
  if (value === undefined || typeof value === "function" || typeof value === "symbol") return skipped;
  if (value === null) return (add(budget, 4), null);
  if (typeof value === "string") return (addString(budget, value), value);
  if (typeof value === "bigint") return convert(value.toString(), budget, depth);
  if (typeof value === "number") return Number.isFinite(value) ? (add(budget, String(value).length), value) : (add(budget, 4), null);
  if (typeof value === "boolean") return (add(budget, value ? 4 : 5), value);
  if (value instanceof ArrayBuffer) return convertBytes(new Uint8Array(value), budget);
  if (ArrayBuffer.isView(value)) return convertBytes(new Uint8Array(value.buffer, value.byteOffset, value.byteLength), budget);
  if (value instanceof Blob) return convert({ size: value.size, type: value.type }, budget, depth + 1);
  if (value instanceof Date) return convert(value.toISOString(), budget, depth + 1); if (value instanceof Map || value instanceof Set || value instanceof RegExp) throw Object.assign(new Error("Map, Set, and RegExp values require an explicit supported representation."), { contentCode: "CONTENT_RESULT_UNSUPPORTED" });
  if (budget.seen.has(value)) return convert("[Circular]", budget, depth + 1);
  budget.seen.add(value);
  if (Array.isArray(value)) {
    if (value.length > MAX_CONTENT_JSON_ITEMS) fail(budget, `${MAX_CONTENT_JSON_ITEMS}-item limit`);
    const output: JsonValue[] = [];
    add(budget, 2);
    for (let index = 0; index < value.length; index += 1) {
      index > 0 && add(budget, 1);
      const item = convert(value[index], budget, depth + 1);
      output.push(item === skipped ? (add(budget, 4), null) : item);
    }
    return output;
  }
  const output: Record<string, JsonValue> = {};
  let count = 0;
  add(budget, 2);
  for (const key in value) {
    if (!Object.hasOwn(value, key)) continue;
    const source = (value as Record<string, unknown>)[key];
    if (source === undefined || typeof source === "function" || typeof source === "symbol") continue;
    if (++count > MAX_CONTENT_JSON_ITEMS) fail(budget, `${MAX_CONTENT_JSON_ITEMS}-item limit`);
    count > 1 && add(budget, 1);
    addString(budget, key);
    add(budget, 1);
    output[key] = convert(source, budget, depth + 1) as JsonValue;
  }
  return output;
};
export const toJsonValueWithBytes = (value: unknown, maximum = MAX_CONTENT_VALUE_BYTES, label = "JSON value") => {
  const budget: Budget = { bytes: 0, maximum, label, seen: new WeakSet<object>() };
  const converted = convert(value, budget, 0);
  return { value: converted === skipped ? (add(budget, 4), null) : converted, encodedBytes: budget.bytes };
};
export const toJsonValue = (value: unknown, maximum = MAX_CONTENT_VALUE_BYTES, label = "JSON value"): JsonValue => toJsonValueWithBytes(value, maximum, label).value;
export const isContentSizeError = (error: unknown) => error instanceof Error && (error as Error & { contentCode?: string }).contentCode === "CONTENT_RESULT_TOO_LARGE";
