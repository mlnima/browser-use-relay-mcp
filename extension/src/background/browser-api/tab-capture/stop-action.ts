import type { BrowserApiHandler } from "../types.js";
import type { CaptureStopMessage, CaptureStopResult } from "./types.js";
import { CAPTURE_RESOURCE_RELEASE_TIMEOUT_MS, CAPTURE_STOP_TIMEOUT_MS } from "../../../offscreen/capture/limits.js";
import { apiCapability, assertActionCapability } from "../capability.js";
import { paramsOf } from "../parameters.js";
import { toJson } from "../json.js";
import { hasCaptureDocument } from "./offscreen-document.js";
import { releaseCaptureResource, trackCaptureDownload } from "./download-cleanup.js";
import { awaitCaptureOperation, captureOperationSignal } from "./capture-operation.js";

const requiredText = (value: unknown, label: string) => {
  if (typeof value !== "string" || !value.length) throw new Error(`${label} is required.`);
  return value;
};
export const stopCaptureAction = async (
  request: Parameters<BrowserApiHandler>[0], signal?: AbortSignal,
) => {
  const params = paramsOf(request);
  const captureId = requiredText(params.captureId, "captureId");
  const filename = requiredText(params.filename, "filename");
  const operationSignal = captureOperationSignal(signal, CAPTURE_STOP_TIMEOUT_MS);
  const wait = <T>(pending: Promise<T>, label: string) => awaitCaptureOperation(pending, operationSignal, label);
  if (!await wait(hasCaptureDocument(), "TAB_CAPTURE_DOCUMENT_TIMEOUT"))
    throw new Error(`No active tab capture exists for ${captureId}.`);
  const message: CaptureStopMessage = { type: "relay.offscreen.capture", operation: "stop", captureId };
  const result = await wait(
    chrome.runtime.sendMessage(message) as Promise<CaptureStopResult>, "TAB_CAPTURE_STOP_TIMEOUT",
  );
  assertActionCapability(apiCapability(chrome.downloads, "download", "chrome.downloads.download"));
  let downloadId: number;
  try {
    downloadId = await wait(chrome.downloads.download({
      url: result.blobUrl, filename,
      ...(typeof params.saveAs === "boolean" && { saveAs: params.saveAs }),
      ...(typeof params.conflictAction === "string" && { conflictAction: params.conflictAction as chrome.downloads.FilenameConflictAction }),
    }), "TAB_CAPTURE_DOWNLOAD_TIMEOUT");
  } catch (error) {
    await awaitCaptureOperation(
      releaseCaptureResource(result.resourceId), AbortSignal.timeout(CAPTURE_RESOURCE_RELEASE_TIMEOUT_MS),
      "TAB_CAPTURE_RESOURCE_RELEASE_TIMEOUT",
    ).catch(() => undefined);
    throw error;
  }
  const download = await wait(trackCaptureDownload(downloadId, result.resourceId), "TAB_CAPTURE_DOWNLOAD_TRACK_TIMEOUT");
  return toJson({
    capture: {
      captureId: result.captureId, tabId: result.tabId, mimeType: result.mimeType, size: result.size,
      startedAt: result.startedAt, stoppedAt: result.stoppedAt, durationMs: result.durationMs,
    },
    download: download || { id: downloadId, filename },
  });
};
