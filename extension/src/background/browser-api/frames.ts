import type { BrowserApiHandler } from "./types.js";
import { MAX_CONTENT_ERROR_CHARACTERS, MAX_CONTENT_RESULT_BYTES, MAX_CONTENT_VALUE_BYTES, MAX_SNAPSHOT_FRAMES } from "../../../../src/protocol/limits.js";
import { toJson } from "./json.js";
import { paramsOf, resolveTabId } from "./parameters.js";
import { readFrame, type FrameReadEnvelope } from "./frame-reader.js";

type Target = chrome.scripting.InjectionTarget;
const encoder = new TextEncoder();
const encodedSize = (value: unknown) => encoder.encode(JSON.stringify(value)).byteLength;
const executeOne = async (target: Target, params: ReturnType<typeof paramsOf>, maximum: number) =>
  await chrome.scripting.executeScript({
    target, world: params.world === "MAIN" ? "MAIN" : "ISOLATED", func: readFrame,
    args: [{ ...params, __relayMaxBytes: maximum }],
  }) as chrome.scripting.InjectionResult<FrameReadEnvelope>[];
const unwrapped = (result: chrome.scripting.InjectionResult<FrameReadEnvelope>) => ({
  frameId: result.frameId, ...(result.documentId && { documentId: result.documentId }), result: result.result?.value ?? null,
});

const executeSingle = async (request: Parameters<BrowserApiHandler>[0]) => {
  const params = paramsOf(request);
  const frameId = request.target?.frameId ?? params.frameId;
  const tabId = await resolveTabId(request);
  const target = request.target?.documentId
    ? { tabId, documentIds: [request.target.documentId] }
    : { tabId, frameIds: [typeof frameId === "number" ? frameId : 0] };
  return toJson((await executeOne(target, params, MAX_CONTENT_VALUE_BYTES)).map(unwrapped));
};

const executeAll = async (request: Parameters<BrowserApiHandler>[0]) => {
  const params = paramsOf(request);
  const tabId = await resolveTabId(request);
  const available = await chrome.webNavigation.getAllFrames({ tabId }) || [];
  const selected = available.slice(0, MAX_SNAPSHOT_FRAMES);
  const frames: unknown[] = [];
  let encodedBytes = 2;
  let byteTruncated = false;
  for (const frame of selected) {
    const remaining = MAX_CONTENT_RESULT_BYTES - encodedBytes;
    if (remaining <= 0) { byteTruncated = true; break; }
    let value: unknown;
    try {
      const results = await executeOne({ tabId, frameIds: [frame.frameId] }, params, Math.min(MAX_CONTENT_VALUE_BYTES, remaining));
      value = results[0] ? unwrapped(results[0]) : { frameId: frame.frameId, result: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      value = { frameId: frame.frameId, error: message.slice(0, MAX_CONTENT_ERROR_CHARACTERS) };
    }
    const requiredBytes = encodedSize(value) + Number(frames.length > 0);
    if (encodedBytes + requiredBytes > MAX_CONTENT_RESULT_BYTES) { byteTruncated = true; break; }
    frames.push(value); encodedBytes += requiredBytes;
  }
  const frameTruncated = selected.length < available.length;
  return toJson({
    frames, totalFrameCount: available.length, returnedFrameCount: frames.length,
    omittedFrameCount: available.length - frames.length, encodedBytes, byteLimit: MAX_CONTENT_RESULT_BYTES,
    truncated: frameTruncated || byteTruncated,
    ...(byteTruncated ? { truncationReason: "byteLimit" } : frameTruncated ? { truncationReason: "frameLimit" } : {}),
  });
};

export const handleFrameAction: BrowserApiHandler = async (request) => {
  switch (request.action) {
    case "listFrames": return toJson(await chrome.webNavigation.getAllFrames({ tabId: await resolveTabId(request) }) || []);
    case "executeInFrame": return executeSingle(request);
    case "executeInAllFrames": return executeAll(request);
    default: return undefined;
  }
};
