import { MAX_FETCH_RESPONSE_BYTES } from "../../../../src/protocol/limits.js";
import type { JsonValue } from "../../../../src/types/json.js";

const encodeBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
};

const responseLimit = (requested: unknown) => {
  if (requested === undefined) return MAX_FETCH_RESPONSE_BYTES;
  if (typeof requested !== "number" || !Number.isSafeInteger(requested) || requested <= 0 || requested > MAX_FETCH_RESPONSE_BYTES) {
    throw new Error(`params.maxResponseBytes must be an integer from 1 to ${MAX_FETCH_RESPONSE_BYTES}.`);
  }
  return requested;
};

export const readFetchResponse = async (response: Response, responseType: unknown, requested: unknown, signal?: AbortSignal): Promise<JsonValue> => {
  const limit = responseLimit(requested);
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`The fetch response exceeds the ${limit}-byte limit.`);
  }
  const reader = response.body?.getReader();
  if (!reader) return responseType === "json" ? null : "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      signal?.throwIfAborted();
      const result = await reader.read();
      if (result.done) break;
      size += result.value.byteLength;
      if (size > limit) {
        await reader.cancel().catch(() => undefined);
        throw new Error(`The fetch response exceeds the ${limit}-byte limit.`);
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (responseType === "base64") return encodeBase64(bytes);
  const text = new TextDecoder().decode(bytes);
  return responseType === "json" ? JSON.parse(text) as JsonValue : text;
};
