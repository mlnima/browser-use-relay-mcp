import type { BrowserApiHandler } from "../types.js";
import type {
  CaptureCancelMessage, CaptureStartMessage, CaptureStatusMessage, CaptureStatusResult,
} from "./types.js";
import { CAPTURE_START_TIMEOUT_MS } from "../../../offscreen/capture/limits.js";
import { assertActionCapability } from "../capability.js";
import { paramsOf, resolveTabId } from "../parameters.js";
import { toJson } from "../json.js";
import { ensureCaptureDocument } from "./offscreen-document.js";
import { awaitCaptureOperation, captureOperationSignal } from "./capture-operation.js";

type TabCaptureApi = { getMediaStreamId?: (options: { targetTabId: number }) => Promise<string> };
const requiredText = (value: unknown, label: string) => {
  if (typeof value !== "string" || !value.length) throw new Error(`${label} is required.`);
  return value;
};
const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);
const cancelStart = (captureId: string) => {
  const message: CaptureCancelMessage = { type: "relay.offscreen.capture", operation: "cancel", captureId };
  void chrome.runtime.sendMessage(message).catch(() => undefined);
};

export const startCaptureAction = async (
  request: Parameters<BrowserApiHandler>[0], signal?: AbortSignal,
) => {
  const params = paramsOf(request);
  const captureId = requiredText(params.captureId, "captureId");
  const operationSignal = captureOperationSignal(signal, CAPTURE_START_TIMEOUT_MS);
  const wait = <T>(pending: Promise<T>, label: string) => awaitCaptureOperation(pending, operationSignal, label);
  const tabId = await wait(resolveTabId(request), "TAB_CAPTURE_START_TIMEOUT");
  await wait(ensureCaptureDocument(operationSignal), "TAB_CAPTURE_DOCUMENT_TIMEOUT");
  const status: CaptureStatusMessage = { type: "relay.offscreen.capture", operation: "status", captureId };
  if ((await wait(chrome.runtime.sendMessage(status) as Promise<CaptureStatusResult>, "TAB_CAPTURE_STATUS_TIMEOUT")).active)
    throw new Error(`Capture ${captureId} is already active.`);
  const getMediaStreamId = (chrome.tabCapture as unknown as TabCaptureApi | undefined)?.getMediaStreamId;
  assertActionCapability(["chrome.tabCapture.getMediaStreamId", typeof getMediaStreamId === "function"]);
  let streamId: string;
  try {
    streamId = await wait(
      getMediaStreamId!.call(chrome.tabCapture, { targetTabId: tabId }), "TAB_CAPTURE_STREAM_ID_TIMEOUT",
    );
  } catch (error) {
    operationSignal.throwIfAborted();
    throw new Error(`Chromium denied tab capture. Invoke the extension from the target tab before retrying. ${errorMessage(error)}`);
  }
  const mediaConstraints = (params.mediaConstraints || params.constraints || {}) as CaptureStartMessage["mediaConstraints"];
  const recorderOptions = (params.recorderOptions || {
    ...(typeof params.mimeType === "string" && { mimeType: params.mimeType }),
    ...(typeof params.audioBitsPerSecond === "number" && { audioBitsPerSecond: params.audioBitsPerSecond }),
    ...(typeof params.videoBitsPerSecond === "number" && { videoBitsPerSecond: params.videoBitsPerSecond }),
    ...(typeof params.bitsPerSecond === "number" && { bitsPerSecond: params.bitsPerSecond }),
  }) as CaptureStartMessage["recorderOptions"];
  const message: CaptureStartMessage = {
    type: "relay.offscreen.capture", operation: "start", captureId, streamId, tabId,
    mediaConstraints, recorderOptions,
    ...(typeof params.timeslice === "number" && { timeslice: params.timeslice }),
  };
  try {
    return toJson(await wait(chrome.runtime.sendMessage(message), "TAB_CAPTURE_START_TIMEOUT"));
  } catch (error) {
    cancelStart(captureId);
    throw new Error(`The offscreen recorder could not consume the tab stream. ${errorMessage(error)}`);
  }
};
