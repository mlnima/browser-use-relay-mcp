import type { ActionRequest } from "../../../../src/types/action.js";
import type { JsonValue } from "../../../../src/types/json.js";
import { DEFAULT_SNAPSHOT_ELEMENTS, MAX_SNAPSHOT_CATALOG_BYTES, MAX_SNAPSHOT_CATALOG_WITH_SCREENSHOT_BYTES, MAX_SNAPSHOT_ELEMENTS, MAX_SNAPSHOT_SCANNED_ELEMENTS, MAX_SNAPSHOT_STRING_CHARACTERS } from "../../../../src/protocol/limits.js";
import { createSnapshotStringLimiter } from "../../shared/snapshot-limit.js";
import { executeContentAction } from "./content-transport";
import { resolveTabId } from "./tab";
import { captureTabImage } from "../browser-api/capture-tab";
import { selectSnapshotFrames } from "./snapshot-frames";

type LimitString = ReturnType<typeof createSnapshotStringLimiter>["limit"];
const errorValue = (limit: LimitString, code: string, error: unknown) =>
  ({ code, message: limit(error instanceof Error ? error.message : String(error))! });
const objectValue = (value: JsonValue | undefined) => value && typeof value === "object" && !Array.isArray(value)
  ? value as Record<string, JsonValue> : undefined;
const countValue = (value: JsonValue | undefined) => typeof value === "number" && Number.isFinite(value)
  ? Math.max(0, Math.floor(value)) : 0;

export const executeSnapshot = async (request: ActionRequest, signal?: AbortSignal): Promise<JsonValue> => {
  const tabId = await resolveTabId(request.target?.tabId);
  const tab = await chrome.tabs.get(tabId);
  const limiter = createSnapshotStringLimiter();
  const frameSelection = await selectSnapshotFrames(request, tabId, tab.url || "", limiter.limit);
  const { frames } = frameSelection;
  const snapshots: JsonValue[] = [];
  const requestedValue = Number(request.params?.maxElements ?? DEFAULT_SNAPSHOT_ELEMENTS);
  const requestedMax = Number.isFinite(requestedValue)
    ? Math.max(0, Math.min(MAX_SNAPSHOT_ELEMENTS, Math.floor(requestedValue))) : DEFAULT_SNAPSHOT_ELEMENTS;
  let remaining = requestedMax;
  let remainingScannedElements = MAX_SNAPSHOT_SCANNED_ELEMENTS;
  const catalogByteLimit = request.params?.includeScreenshot
    ? MAX_SNAPSHOT_CATALOG_WITH_SCREENSHOT_BYTES : MAX_SNAPSHOT_CATALOG_BYTES;
  let remainingCatalogBytes = catalogByteLimit;
  let encodedBytes = 0, returnedElementCount = 0, scannedElementCount = 0, stringTruncationCount = 0;
  let omittedAttributeCount = 0, omittedSelectedValueCount = 0;
  let omittedElementCount = 0;
  let elementTruncated = false, byteTruncated = false, scanTruncated = false;
  for (const frame of frames) {
    const target = { ...request.target, tabId, frameId: frame.frameId, documentId: frame.documentId };
    try {
      const result = await executeContentAction({
        ...request, target, params: { ...request.params, maxElements: remaining, maxCatalogBytes: remainingCatalogBytes, maxScannedElements: remainingScannedElements },
      }, signal);
      if (!result.success || !result.data || typeof result.data !== "object" || Array.isArray(result.data)) {
        snapshots.push({ frameId: frame.frameId, ...(frame.documentId && { documentId: frame.documentId }), url: frame.url, error: errorValue(limiter.limit, result.error?.code || "FRAME_SNAPSHOT_FAILED", result.error?.message || "Frame snapshot failed.") });
        continue;
      }
      const data = result.data as Record<string, JsonValue>;
      const catalog = objectValue(data.catalog);
      const count = Array.isArray(data.elements) ? data.elements.length : 0;
      remaining = Math.max(0, remaining - count);
      returnedElementCount += count;
      const frameBytes = Math.min(remainingCatalogBytes, countValue(catalog?.encodedBytes));
      remainingCatalogBytes -= frameBytes;
      encodedBytes += frameBytes;
      const frameScanned = countValue(catalog?.scannedElementCount);
      scannedElementCount += frameScanned; remainingScannedElements = Math.max(0, remainingScannedElements - frameScanned);
      stringTruncationCount += countValue(catalog?.stringTruncationCount);
      omittedAttributeCount += countValue(catalog?.omittedAttributeCount);
      omittedSelectedValueCount += countValue(catalog?.omittedSelectedValueCount);
      omittedElementCount += countValue(catalog?.omittedElementCount);
      elementTruncated ||= catalog?.truncationReason === "maxElements";
      byteTruncated ||= catalog?.truncationReason === "maxBytes";
      scanTruncated ||= catalog?.truncationReason === "maxScannedElements";
      snapshots.push({ ...data, frameId: frame.frameId, ...(frame.documentId && { documentId: frame.documentId }), url: frame.url || data.url });
    } catch (error) {
      signal?.throwIfAborted();
      snapshots.push({ frameId: frame.frameId, ...(frame.documentId && { documentId: frame.documentId }), url: frame.url, error: errorValue(limiter.limit, "FRAME_SNAPSHOT_UNAVAILABLE", error) });
    }
  }
  let page: JsonValue;
  try {
    const result = await executeContentAction({ ...request, action: "getPageState", target: { tabId, frameId: 0 } }, signal);
    page = result.success && result.data !== undefined
      ? result.data
      : { error: errorValue(limiter.limit, result.error?.code || "PAGE_STATE_FAILED", result.error?.message || "Top-page state failed.") };
  } catch (error) {
    signal?.throwIfAborted();
    page = { error: errorValue(limiter.limit, "PAGE_STATE_UNAVAILABLE", error) };
  }
  signal?.throwIfAborted();
  const screenshot = request.params?.includeScreenshot ? (await captureTabImage(tabId, { format: "png" }, signal)).dataUrl : undefined;
  return {
    capturedAt: new Date().toISOString(),
    tabId,
    url: limiter.limit(tab.url || "")!,
    title: limiter.limit(tab.title || "")!,
    frames: snapshots,
    page,
    catalog: {
      byteLimit: catalogByteLimit, encodedBytes, requestedElementLimit: requestedMax,
      returnedFrameCount: frames.length, totalFrameCount: frameSelection.totalFrameCount,
      omittedFrameCount: frameSelection.omittedFrameCount,
      returnedElementCount, scannedElementCount, scannedElementLimit: MAX_SNAPSHOT_SCANNED_ELEMENTS, stringTruncationCount,
      omittedAttributeCount, omittedSelectedValueCount, truncated: elementTruncated || byteTruncated || scanTruncated,
      omittedElementCount,
      ...(byteTruncated ? { truncationReason: "maxBytes" } : elementTruncated ? { truncationReason: "maxElements" } : scanTruncated ? { truncationReason: "maxScannedElements" } : {}),
    },
    outputLimits: { stringCharacterLimit: MAX_SNAPSHOT_STRING_CHARACTERS, stringTruncationCount: limiter.stats.truncatedStrings },
    ...(screenshot && { screenshot }),
  };
};
