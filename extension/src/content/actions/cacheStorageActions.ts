import type { ContentActionHandler } from "./types.js";
import {
  cacheBase64, cacheHeaders, cacheLimit, cacheText, DEFAULT_CACHE_ENTRIES, DEFAULT_CACHE_NAMES,
  MAX_CACHE_BODY_BYTES, MAX_CACHE_ENTRIES, MAX_CACHE_INSPECT_BODY_BYTES, MAX_CACHE_NAMES, readCacheBytes,
} from "./cache-storage-values";

const cacheName = (value: unknown) => {
  if (typeof value !== "string" || !value) throw new Error("A cache name is required.");
  return value;
};

export const cacheStorageActionHandlers: Record<string, ContentActionHandler> = {
  inspectCacheStorage: async ({ request }) => {
    const names = await caches.keys();
    const maxCaches = cacheLimit(request.params?.maxCaches, DEFAULT_CACHE_NAMES, MAX_CACHE_NAMES, "maxCaches");
    const limit = cacheLimit(request.params?.limit, DEFAULT_CACHE_ENTRIES, MAX_CACHE_ENTRIES, "limit");
    const selected = (typeof request.params?.cache === "string" ? names.filter((name) => name === request.params?.cache) : names).slice(0, maxCaches);
    const inspected = [];
    let remaining = limit;
    let bodyBytes = 0;
    for (const name of selected) {
      const cache = await caches.open(name);
      const allRequests = await cache.keys();
      const entries = [];
      for (const cachedRequest of allRequests.slice(0, remaining)) {
        const response = await cache.match(cachedRequest);
        const requestHeaders = cacheHeaders(cachedRequest.headers);
        const responseHeaders = response && cacheHeaders(response.headers);
        const body = response && request.params?.includeBodies === true && bodyBytes < MAX_CACHE_BODY_BYTES
          ? await readCacheBytes(response.clone(), Math.min(MAX_CACHE_INSPECT_BODY_BYTES, MAX_CACHE_BODY_BYTES - bodyBytes)) : undefined;
        if (body) bodyBytes += body.bytes.byteLength;
        entries.push({
          request: { url: cacheText(cachedRequest.url), method: cacheText(cachedRequest.method), headers: requestHeaders.values, omittedHeaders: requestHeaders.omitted },
          response: response ? {
            url: cacheText(response.url), status: response.status, statusText: cacheText(response.statusText), type: response.type,
            headers: responseHeaders!.values, omittedHeaders: responseHeaders!.omitted,
            ...(body && { body: new TextDecoder().decode(body.bytes), bodyBytes: body.bytes.byteLength, bodyTruncated: body.truncated }),
            ...(request.params?.includeBodies === true && !body && { bodyOmitted: "aggregateByteLimit" }),
          } : null,
        });
      }
      remaining -= entries.length;
      inspected.push({ name: cacheText(name), entryCount: allRequests.length, omittedEntries: Math.max(0, allRequests.length - entries.length), entries });
      if (!remaining) break;
    }
    return {
      cacheNames: names.slice(0, maxCaches).map(cacheText), totalCacheCount: names.length,
      omittedCacheNames: Math.max(0, names.length - maxCaches), omittedSelectedCaches: Math.max(0, selected.length - inspected.length),
      caches: inspected, bodyBytes, bodyByteLimit: MAX_CACHE_BODY_BYTES, entryLimit: limit,
    };
  },
  readCacheStorage: async ({ request }) => {
    const response = await caches.match(String(request.params?.url ?? ""), { cacheName: cacheName(request.params?.cache) });
    if (!response) return null;
    const body = await readCacheBytes(response, cacheLimit(request.params?.maxBodyBytes, MAX_CACHE_BODY_BYTES, MAX_CACHE_BODY_BYTES, "maxBodyBytes"));
    if (body.truncated) throw new Error("The cached response exceeds the requested body-byte limit.");
    const headers = cacheHeaders(response.headers);
    return {
      status: response.status,
      statusText: cacheText(response.statusText),
      headers: headers.values,
      omittedHeaders: headers.omitted,
      bodyBase64: cacheBase64(body.bytes),
      bodyBytes: body.bytes.byteLength,
    };
  },
  writeCacheStorage: async ({ request }) => {
    const cache = await caches.open(cacheName(request.params?.cache));
    const headers = request.params?.headers as Record<string, string> | undefined;
    const body = String(request.params?.body ?? "");
    await cache.put(String(request.params?.url ?? ""), new Response(body, {
      status: Number(request.params?.status ?? 200),
      headers,
    }));
    return true;
  },
  deleteCacheStorage: async ({ request }) => {
    const name = cacheName(request.params?.cache);
    if (request.params?.all === true) return caches.delete(name);
    if (typeof request.params?.url !== "string") throw new Error("A cached URL or explicit params.all=true is required.");
    return (await caches.open(name)).delete(request.params.url);
  },
};
