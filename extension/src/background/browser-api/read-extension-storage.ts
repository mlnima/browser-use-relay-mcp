import {
  DEFAULT_EXTENSION_STORAGE_KEYS, MAX_EXTENSION_STORAGE_KEYS, MAX_EXTENSION_STORAGE_READ_BYTES,
} from "../../../../src/protocol/limits.js";
import type { JsonValue } from "../../../../src/types/json.js";
import { jsonByteLengthWithin } from "../native/json-byte-limit.js";

type AreaWithKeys = { getKeys?: (callback: (keys: string[]) => void) => void };
export const extensionStorageKeys = (area: chrome.storage.StorageArea) => new Promise<string[]>((resolve, reject) => {
  const getKeys = (area as unknown as AreaWithKeys).getKeys;
  if (!getKeys) throw new Error("This browser does not support bounded extension-storage key enumeration.");
  getKeys.call(area, (keys) => chrome.runtime.lastError
    ? reject(new Error(chrome.runtime.lastError.message || "Extension-storage key enumeration failed."))
    : resolve(keys));
});
const requestedKeys = async (area: chrome.storage.StorageArea, value: JsonValue | undefined) => {
  if (value === undefined || value === null) return extensionStorageKeys(area);
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    if (!value.every((key) => typeof key === "string")) throw new Error("Extension storage keys must be strings.");
    return value as string[];
  }
  if (typeof value === "object") return Object.keys(value);
  throw new Error("Extension storage keys must be a string, string array, or defaults object.");
};
const readLimit = (value: JsonValue | undefined) => {
  const limit = value === undefined ? DEFAULT_EXTENSION_STORAGE_KEYS : value;
  if (typeof limit !== "number" || !Number.isSafeInteger(limit) || limit < 1 || limit > MAX_EXTENSION_STORAGE_KEYS) {
    throw new Error(`Extension storage limit must be an integer from 1 to ${MAX_EXTENSION_STORAGE_KEYS}.`);
  }
  return limit;
};

export const readExtensionStorage = async (area: chrome.storage.StorageArea, params: Record<string, JsonValue>) => {
  const requested = params.keys ?? params.key;
  const defaults = requested && typeof requested === "object" && !Array.isArray(requested)
    ? requested as Record<string, JsonValue> : undefined;
  const allKeys = [...new Set(await requestedKeys(area, requested))].sort();
  const afterKey = typeof params.afterKey === "string" ? params.afterKey : undefined;
  const available = afterKey === undefined ? allKeys : allKeys.filter((key) => key > afterKey);
  const pageKeys = available.slice(0, readLimit(params.limit));
  const items = Object.create(null) as Record<string, JsonValue>;
  let encodedBytes = 2;
  let lastKey: string | undefined;
  let byteTruncated = false;
  for (const key of pageKeys) {
    const stored = await area.get(key);
    const present = Object.hasOwn(stored, key) || Boolean(defaults && Object.hasOwn(defaults, key));
    const value = Object.hasOwn(stored, key) ? stored[key] : defaults?.[key];
    const size = present ? jsonByteLengthWithin({ [key]: value }, MAX_EXTENSION_STORAGE_READ_BYTES - encodedBytes) : 0;
    if (size === undefined) {
      if (!lastKey) throw new Error(`Extension storage value "${key}" exceeds the ${MAX_EXTENSION_STORAGE_READ_BYTES}-byte read limit.`);
      byteTruncated = true;
      break;
    }
    if (present) { items[key] = value as JsonValue; encodedBytes += size || 0; }
    lastKey = key;
  }
  const truncated = byteTruncated || pageKeys.length < available.length;
  return {
    items, totalKeys: allKeys.length, returnedKeys: Object.keys(items).length, scannedKeys: lastKey ? pageKeys.indexOf(lastKey) + 1 : 0,
    encodedBytes, byteLimit: MAX_EXTENSION_STORAGE_READ_BYTES, truncated,
    ...(truncated && lastKey && { nextAfterKey: lastKey }),
  };
};
