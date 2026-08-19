export const MAX_CACHE_NAMES = 100;
export const DEFAULT_CACHE_NAMES = 20;
export const MAX_CACHE_ENTRIES = 1_000;
export const DEFAULT_CACHE_ENTRIES = 100;
export const MAX_CACHE_BODY_BYTES = 8 * 1024 * 1024;
export const MAX_CACHE_INSPECT_BODY_BYTES = 1024 * 1024;
export const MAX_CACHE_FIELD_CHARS = 8_192;

export const cacheLimit = (value: unknown, fallback: number, maximum: number, label: string) => {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${label} must be an integer from 1 to ${maximum}.`);
  }
  return value;
};
export const cacheText = (value: string) => value.slice(0, MAX_CACHE_FIELD_CHARS);
export const cacheHeaders = (headers: Headers) => {
  const values: Record<string, string> = {};
  let characters = 0;
  let omitted = 0;
  for (const [name, value] of headers) {
    const remaining = MAX_CACHE_FIELD_CHARS - characters;
    if (remaining <= 0 || Object.keys(values).length >= 100) {
      omitted += 1;
      continue;
    }
    const bounded = value.slice(0, remaining);
    values[name] = bounded;
    characters += name.length + bounded.length;
    if (bounded.length < value.length) omitted += 1;
  }
  return { values, omitted };
};
const combine = (chunks: Uint8Array[], size: number) => {
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
};
export const readCacheBytes = async (response: Response, limit: number) => {
  const reader = response.body?.getReader();
  if (!reader) return { bytes: new Uint8Array(), truncated: false };
  const chunks: Uint8Array[] = [];
  let size = 0;
  let truncated = false;
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      const remaining = limit - size;
      if (result.value.byteLength > remaining) {
        if (remaining > 0) chunks.push(result.value.subarray(0, remaining));
        size += Math.max(remaining, 0);
        truncated = true;
        await reader.cancel().catch(() => undefined);
        break;
      }
      chunks.push(result.value);
      size += result.value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  return { bytes: combine(chunks, size), truncated };
};
export const cacheBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
};
