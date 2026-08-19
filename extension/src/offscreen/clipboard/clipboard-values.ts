import {
  MAX_CLIPBOARD_ITEMS, MAX_CLIPBOARD_TOTAL_BYTES, MAX_CLIPBOARD_TYPE_CHARACTERS, MAX_CLIPBOARD_TYPES,
} from "../../../../src/protocol/limits.js";
import type { ClipboardValue } from "./types.js";

const encoder = new TextEncoder();
const base64Limit = Math.ceil(MAX_CLIPBOARD_TOTAL_BYTES / 3) * 4;
const fail = () => { throw new Error(`Clipboard data exceeds the ${MAX_CLIPBOARD_TOTAL_BYTES}-byte limit.`); };

export const clipboardItems = <Value>(values: Value[]) => {
  if (values.length > MAX_CLIPBOARD_ITEMS) throw new Error(`Clipboard data exceeds the ${MAX_CLIPBOARD_ITEMS}-item limit.`);
  return values;
};
export const clipboardTypes = (values: readonly string[]) => {
  if (values.length > MAX_CLIPBOARD_TYPES) throw new Error(`Clipboard data exceeds the ${MAX_CLIPBOARD_TYPES}-type limit.`);
  for (const value of values) {
    if (!value || value.length > MAX_CLIPBOARD_TYPE_CHARACTERS) throw new Error("A clipboard MIME type is invalid or too long.");
  }
  return values;
};
export const clipboardText = (value: string, remaining = MAX_CLIPBOARD_TOTAL_BYTES) => {
  if (value.length > remaining) fail();
  const bytes = encoder.encode(value);
  if (bytes.byteLength > remaining) fail();
  return bytes;
};
const decode = (value: string, remaining: number) => {
  if (value.length > base64Limit || value.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) fail();
  const size = Math.floor(value.length * 3 / 4) - (value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0);
  if (size > remaining || size > MAX_CLIPBOARD_TOTAL_BYTES) fail();
  const bytes = new Uint8Array(size);
  let written = 0;
  for (let offset = 0; offset < value.length; offset += 0x8000) {
    const binary = atob(value.slice(offset, offset + 0x8000));
    for (let index = 0; index < binary.length; index += 1) bytes[written + index] = binary.charCodeAt(index);
    written += binary.length;
  }
  if (written !== size) fail();
  return bytes;
};
export const clipboardBlob = (type: string, value: ClipboardValue, remaining: number) => {
  const bytes = value.base64 !== undefined ? decode(value.base64, remaining) : clipboardText(value.text || "", remaining);
  return { blob: new Blob([bytes], { type }), bytes: bytes.byteLength };
};
export const encodeClipboardBlob = async (blob: Blob, remaining: number) => {
  if (blob.size > remaining || blob.size > MAX_CLIPBOARD_TOTAL_BYTES) fail();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return { base64: btoa(binary), size: bytes.byteLength };
};
