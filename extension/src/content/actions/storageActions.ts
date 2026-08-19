import { DEFAULT_CONTENT_STORAGE_ENTRIES, MAX_CONTENT_QUERY_OFFSET, MAX_CONTENT_STORAGE_ENTRIES, MAX_CONTENT_VALUE_BYTES } from "../../../../src/protocol/limits.js";
import type { JsonValue } from "../../../../src/types/json.js";
import type { ContentActionHandler } from "./types.js";
import { toJsonValue, toJsonValueWithBytes } from "./element.js";

const integer = (value: JsonValue | undefined, fallback: number, minimum: number, maximum: number, label: string) => {
  const resolved = value === undefined ? fallback : value;
  if (typeof resolved !== "number" || !Number.isSafeInteger(resolved) || resolved < minimum || resolved > maximum) throw new Error(`${label} must be an integer from ${minimum} to ${maximum}.`);
  return resolved;
};
const readStorage = (storage: Storage, params?: Record<string, JsonValue>) => {
  if (typeof params?.key === "string") return toJsonValue(storage.getItem(params.key), MAX_CONTENT_VALUE_BYTES, "Storage value");
  const offset = integer(params?.offset, 0, 0, MAX_CONTENT_QUERY_OFFSET, "offset");
  const limit = integer(params?.limit, DEFAULT_CONTENT_STORAGE_ENTRIES, 1, MAX_CONTENT_STORAGE_ENTRIES, "limit");
  const total = storage.length;
  const entries: JsonValue[] = [];
  let encodedBytes = 2;
  let index = offset;
  let truncationReason: "limit" | "byteLimit" | undefined;
  while (index < total && entries.length < limit) {
    const key = storage.key(index);
    if (key === null) { index += 1; continue; }
    const output = toJsonValueWithBytes({ key, value: storage.getItem(key) }, MAX_CONTENT_VALUE_BYTES - 2, "Storage entry");
    const requiredBytes = output.encodedBytes + Number(entries.length > 0);
    if (encodedBytes + requiredBytes > MAX_CONTENT_VALUE_BYTES) { truncationReason = "byteLimit"; break; }
    entries.push(output.value);
    encodedBytes += requiredBytes;
    index += 1;
  }
  if (!truncationReason && index < total) truncationReason = "limit";
  const truncated = Boolean(truncationReason);
  return {
    entries, total, offset, limit, returnedEntryCount: entries.length, truncated,
    nextOffset: truncated ? index : null, encodedBytes, byteLimit: MAX_CONTENT_VALUE_BYTES,
    ...(truncationReason && { truncationReason }),
  };
};
const writeStorage = (storage: Storage, key: unknown, value: unknown) => {
  if (typeof key !== "string") throw new Error("A storage key is required.");
  storage.setItem(key, String(value ?? ""));
  return true;
};
const deleteStorage = (storage: Storage, key: unknown, all: unknown) => {
  if (typeof key === "string") storage.removeItem(key);
  else if (all === true) storage.clear();
  else throw new Error("A storage key or explicit params.all=true is required.");
  return true;
};

export const storageActionHandlers: Record<string, ContentActionHandler> = {
  readLocalStorage: async ({ request }) => readStorage(localStorage, request.params),
  writeLocalStorage: async ({ request }) => writeStorage(localStorage, request.params?.key, request.params?.value),
  deleteLocalStorage: async ({ request }) => deleteStorage(localStorage, request.params?.key, request.params?.all),
  readSessionStorage: async ({ request }) => readStorage(sessionStorage, request.params),
  writeSessionStorage: async ({ request }) => writeStorage(sessionStorage, request.params?.key, request.params?.value),
  deleteSessionStorage: async ({ request }) => deleteStorage(sessionStorage, request.params?.key, request.params?.all),
};
