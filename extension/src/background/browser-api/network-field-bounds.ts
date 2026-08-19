import type { JsonValue } from "../../../../src/types/json.js";
import {
  NETWORK_BINARY_HEADER_MAX_BYTES, NETWORK_HEADER_MAX_COUNT, NETWORK_HEADER_NAME_MAX_BYTES,
  NETWORK_HEADER_VALUE_MAX_BYTES, NETWORK_HEADERS_MAX_BYTES,
} from "./network-observation-limits";

const encoder = new TextEncoder();
export const jsonByteLength = (value: JsonValue) => encoder.encode(JSON.stringify(value)).byteLength;
export const boundedNetworkText = (value: unknown, maxBytes: number) => {
  const candidate = String(value ?? "").slice(0, maxBytes);
  if (encoder.encode(candidate).byteLength <= maxBytes) return candidate;
  let low = 0;
  let high = candidate.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (encoder.encode(candidate.slice(0, middle)).byteLength <= maxBytes) low = middle;
    else high = middle - 1;
  }
  const result = candidate.slice(0, low);
  return /[\uD800-\uDBFF]$/.test(result) ? result.slice(0, -1) : result;
};
type Header = { name: string; value?: string; binaryValue?: ArrayBuffer };
export const boundedHeaderList = (values?: Header[]): JsonValue => {
  const result: JsonValue[] = [];
  let bytes = 2;
  for (const header of values || []) {
    if (result.length >= NETWORK_HEADER_MAX_COUNT) break;
    const name = boundedNetworkText(header.name, NETWORK_HEADER_NAME_MAX_BYTES);
    const value = header.value === undefined ? undefined : boundedNetworkText(header.value, NETWORK_HEADER_VALUE_MAX_BYTES);
    const binary = header.binaryValue
      ? [...new Uint8Array(header.binaryValue, 0, Math.min(header.binaryValue.byteLength, NETWORK_BINARY_HEADER_MAX_BYTES))]
      : undefined;
    const entry: JsonValue = { name, ...(value !== undefined && { value }), ...(binary && { binaryValue: binary }) };
    const size = jsonByteLength(entry) + (result.length ? 1 : 0);
    if (bytes + size > NETWORK_HEADERS_MAX_BYTES) break;
    result.push(entry);
    bytes += size;
  }
  return result;
};
export const boundedHeaderRecord = (value: unknown): JsonValue => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const result: Record<string, JsonValue> = Object.create(null) as Record<string, JsonValue>;
  let count = 0;
  let scanned = 0;
  let bytes = 2;
  for (const rawName in source) {
    if (!Object.hasOwn(source, rawName)) continue;
    if (scanned >= NETWORK_HEADER_MAX_COUNT) break;
    scanned += 1;
    const name = boundedNetworkText(rawName, NETWORK_HEADER_NAME_MAX_BYTES);
    const bounded = boundedNetworkText(source[rawName], NETWORK_HEADER_VALUE_MAX_BYTES);
    const size = jsonByteLength([name, bounded]) + (count ? 1 : 0);
    if (bytes + size > NETWORK_HEADERS_MAX_BYTES) break;
    if (Object.hasOwn(result, name)) continue;
    result[name] = bounded;
    bytes += size;
    count += 1;
  }
  return result;
};
