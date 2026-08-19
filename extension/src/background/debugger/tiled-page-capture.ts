import { sendDebuggerCommand } from "./debugger-session";
import { MAX_SCREENSHOT_BLOB_BYTES, blobDataUrl, screenshotBitmap, validateScreenshotDimensions } from "./screenshot-codec";

type PageSize = { x: number; y: number; width: number; height: number };
type ScreenshotData = { data: string };
type ScreenshotOptions = { format: "jpeg" | "png"; quality?: number };

const validate = (size: PageSize) => {
  if (![size.x, size.y].every(Number.isFinite)) throw new Error("The document has no capturable page area.");
  return validateScreenshotDimensions(size.width, size.height, "Full-page screenshot");
};

export const capturePageTiles = async (tabId: number, size: PageSize, requestedTileHeight: number, options: ScreenshotOptions, signal?: AbortSignal) => {
  const dimensions = validate(size);
  const tileHeight = Math.max(1, Math.min(4_096, Math.floor(requestedTileHeight || 2_048)));
  const tileCount = Math.ceil(dimensions.height / tileHeight);
  const canvas = new OffscreenCanvas(dimensions.width, dimensions.height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Full-page screenshot assembly is unavailable in this browser.");
  if (options.format === "jpeg") {
    context.fillStyle = "#fff";
    context.fillRect(0, 0, dimensions.width, dimensions.height);
  }
  for (let index = 0; index < tileCount; index += 1) {
    signal?.throwIfAborted();
    const top = index * tileHeight;
    const height = Math.min(tileHeight, dimensions.height - top);
    const shot = await sendDebuggerCommand<ScreenshotData>(tabId, "Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: true,
      clip: { x: size.x, y: size.y + top, width: size.width, height, scale: 1 },
    });
    const bitmap = await screenshotBitmap(shot.data, "png");
    try {
      context.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height, 0, top, dimensions.width, height);
    } finally {
      bitmap.close();
    }
  }
  signal?.throwIfAborted();
  const blob = await canvas.convertToBlob({ type: `image/${options.format}`, ...(options.quality !== undefined && { quality: options.quality / 100 }) });
  if (blob.size > MAX_SCREENSHOT_BLOB_BYTES) throw new Error("The assembled screenshot exceeds the native relay transport limit; use JPEG or capture a smaller region.");
  const dataUrl = await blobDataUrl(blob);
  signal?.throwIfAborted();
  return { dataUrl, ...dimensions, tileCount, tileHeight };
};
