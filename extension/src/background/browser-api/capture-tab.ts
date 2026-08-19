import { parseScreenshotDataUrl, screenshotBitmap, validateScreenshotDimensions } from "../debugger/screenshot-codec.js";

let captureQueue: Promise<void> = Promise.resolve();
type CaptureOptions = { format?: "jpeg" | "png"; quality?: number };

const capture = async (tabId: number, options: CaptureOptions, signal?: AbortSignal) => {
  signal?.throwIfAborted();
  const tab = await chrome.tabs.get(tabId);
  const [previous] = await chrome.tabs.query({ active: true, windowId: tab.windowId });
  const switched = previous?.id !== tabId;
  if (switched) await chrome.tabs.update(tabId, { active: true });
  try {
    signal?.throwIfAborted();
    const image = await chrome.tabs.captureVisibleTab(tab.windowId, options);
    signal?.throwIfAborted();
    const parsed = parseScreenshotDataUrl(image);
    const bitmap = await screenshotBitmap(parsed.data, parsed.format);
    try {
      const dimensions = validateScreenshotDimensions(bitmap.width, bitmap.height, "Visible-tab screenshot");
      signal?.throwIfAborted();
      return { dataUrl: image, ...dimensions };
    } finally { bitmap.close(); }
  } finally {
    if (switched && typeof previous?.id === "number") {
      await chrome.tabs.get(previous.id).then(() => chrome.tabs.update(previous.id!, { active: true })).catch(() => undefined);
    }
  }
};

export const captureTabImage = (tabId: number, options: CaptureOptions, signal?: AbortSignal) => {
  const operation = captureQueue.then(() => capture(tabId, options, signal));
  captureQueue = operation.then(() => undefined, () => undefined);
  return operation;
};
