import type { ActionRequest } from "../../../../src/types/action.js";
import { sendDebuggerCommand } from "./debugger-session";
import { resolveBounds } from "./resolve-point";
import { capturePageTiles } from "./tiled-page-capture";
import { screenshotBitmap, screenshotDataUrl, validateScreenshotDimensions } from "./screenshot-codec";

type Viewport = { pageX: number; pageY: number; clientHeight?: number };
type Size = { x: number; y: number; width: number; height: number };
type LayoutMetrics = {
  layoutViewport: Viewport;
  visualViewport?: Viewport;
  contentSize: Size;
  cssVisualViewport?: Viewport;
  cssContentSize?: Size;
};
type ScreenshotData = { data: string };
type CaptureOptions = { format: "jpeg" | "png"; quality?: number; fromSurface: boolean; captureBeyondViewport: boolean };

const optionsFor = (request: ActionRequest): CaptureOptions => {
  const format = request.params?.format === "jpeg" ? "jpeg" : "png";
  return {
    format,
    ...(format === "jpeg" && { quality: Number(request.params?.quality ?? 90) }),
    fromSurface: true,
    captureBeyondViewport: true,
  };
};

const validSize = (size: Size) => [size.x, size.y, size.width, size.height].every(Number.isFinite)
  && size.width > 0 && size.height > 0;

export const captureFullPage = async (request: ActionRequest, tabId: number, signal?: AbortSignal) => {
  signal?.throwIfAborted();
  const metrics = await sendDebuggerCommand<LayoutMetrics>(tabId, "Page.getLayoutMetrics");
  const size = metrics.cssContentSize || metrics.contentSize;
  if (!validSize(size)) throw new Error("The document has no capturable page area.");
  return capturePageTiles(tabId, size, metrics.layoutViewport.clientHeight || 2_048, optionsFor(request), signal);
};

export const capturePageElement = async (request: ActionRequest, tabId: number, signal?: AbortSignal) => {
  const bounds = await resolveBounds(request, tabId, signal);
  const metrics = await sendDebuggerCommand<LayoutMetrics>(tabId, "Page.getLayoutMetrics");
  const viewport = metrics.cssVisualViewport || metrics.visualViewport || metrics.layoutViewport;
  const clip = { x: viewport.pageX + bounds.x, y: viewport.pageY + bounds.y, width: bounds.width, height: bounds.height, scale: 1 };
  if (!validSize(clip)) throw new Error("The target element has no capturable page area.");
  validateScreenshotDimensions(clip.width, clip.height, "Element screenshot");
  signal?.throwIfAborted();
  const options = optionsFor(request);
  const shot = await sendDebuggerCommand<ScreenshotData>(tabId, "Page.captureScreenshot", { ...options, clip });
  const bitmap = await screenshotBitmap(shot.data, options.format);
  let dimensions;
  try { dimensions = validateScreenshotDimensions(bitmap.width, bitmap.height, "Decoded element screenshot"); }
  finally { bitmap.close(); }
  return { dataUrl: screenshotDataUrl(shot.data, options.format), ...dimensions, clip };
};
