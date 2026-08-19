import type { BrowserApiHandler } from "./types.js";
import { paramsOf, resolveTabId } from "./parameters.js";
import { toJson } from "./json.js";
import { captureTabImage } from "./capture-tab.js";
import { blobDataUrl, parseScreenshotDataUrl, screenshotBitmap, validateScreenshotDimensions } from "../debugger/screenshot-codec.js";

type Rect = { x: number; y: number; width: number; height: number };

const crop = async (
  imageUrl: string,
  rect: Rect,
  scale: number,
  format: "jpeg" | "png",
  quality?: number,
) => {
  const width = Math.round(rect.width * scale);
  const height = Math.round(rect.height * scale);
  if (![rect.x, rect.y, rect.width, rect.height, scale, width, height].every(Number.isFinite)) throw new Error("The screenshot crop rectangle is invalid or empty.");
  const dimensions = validateScreenshotDimensions(width, height, "Screenshot crop");
  const parsed = parseScreenshotDataUrl(imageUrl);
  const bitmap = await screenshotBitmap(parsed.data, parsed.format);
  try {
    validateScreenshotDimensions(bitmap.width, bitmap.height, "Captured viewport screenshot");
    if (rect.x * scale < 0 || rect.y * scale < 0 || (rect.x + rect.width) * scale > bitmap.width || (rect.y + rect.height) * scale > bitmap.height) throw new Error("The screenshot crop rectangle is outside the captured viewport.");
    const canvas = new OffscreenCanvas(dimensions.width, dimensions.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Screenshot cropping is unavailable.");
    context.drawImage(bitmap, rect.x * scale, rect.y * scale, rect.width * scale, rect.height * scale, 0, 0, canvas.width, canvas.height);
    const blob = await canvas.convertToBlob({
      type: format === "jpeg" ? "image/jpeg" : "image/png",
      ...(typeof quality === "number" && { quality: quality / 100 }),
    });
    const cropped = await blobDataUrl(blob);
    return { dataUrl: cropped, width, height, clip: rect };
  } finally { bitmap.close(); }
};

const capture = async (request: Parameters<BrowserApiHandler>[0], signal?: AbortSignal) => {
  const params = paramsOf(request);
  const tab = await chrome.tabs.get(await resolveTabId(request));
  const format = params.format === "jpeg" ? "jpeg" : "png";
  const image = await captureTabImage(tab.id!, {
    format,
    ...(typeof params.quality === "number" && { quality: params.quality }),
  }, signal);
  if (request.action !== "captureElement") return image;
  const [scaleResult] = await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    func: () => devicePixelRatio,
  });
  return crop(
    image.dataUrl,
    params.rect as Rect,
    typeof params.scale === "number" ? params.scale : Number(scaleResult?.result || 1),
    format,
    params.quality as number | undefined,
  );
};

export const handleScreenshotAction: BrowserApiHandler = async (request, signal) => {
  if (!["captureVisibleTab", "captureViewport", "captureElement"].includes(request.action)) return undefined;
  if (request.action === "captureElement" && !request.params?.rect) return undefined;
  return toJson(await capture(request, signal));
};
