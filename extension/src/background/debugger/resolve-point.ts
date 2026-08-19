import type { ActionRequest } from "../../../../src/types/action.js";
import { executeContentAction } from "../actions/content-transport";
import { readFrameViewport, resolveBrowserFrameId, translateFrameBounds } from "./frame-coordinates";
import { sendDebuggerCommand } from "./debugger-session";
import { executionError } from "../actions/execution-error";

export type ViewportPoint = { x: number; y: number };
export type ElementPathStep = { scope: "document" | "children" | "shadow"; index: number };
export type ViewportBounds = ViewportPoint & { width: number; height: number; hitX?: number; hitY?: number; path?: ElementPathStep[] };

type LayoutMetrics = { layoutViewport: { clientWidth: number; clientHeight: number } };

const coordinateBounds = async (request: ActionRequest, tabId: number, signal?: AbortSignal): Promise<ViewportBounds> => {
  const x = request.target?.x;
  const y = request.target?.y;
  if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) throw new Error("Target coordinates must be finite numbers.");
  signal?.throwIfAborted();
  const bounds = { x, y, width: 0, height: 0, hitX: x, hitY: y };
  if (await resolveBrowserFrameId(request, tabId)) {
    const viewport = await readFrameViewport(request, signal);
    if (x < 0 || y < 0 || x >= viewport.width || y >= viewport.height) throw new Error("Target coordinates are outside the selected frame viewport.");
    return translateFrameBounds(request, tabId, bounds, signal, viewport);
  }
  const { layoutViewport } = await sendDebuggerCommand<LayoutMetrics>(tabId, "Page.getLayoutMetrics");
  if (x < 0 || y < 0 || x >= layoutViewport.clientWidth || y >= layoutViewport.clientHeight) throw new Error("Target coordinates are outside the top-frame viewport.");
  return bounds;
};

export const resolveElementPath = async (request: ActionRequest, signal?: AbortSignal) => {
  const result = await executeContentAction({ ...request, action: "getBoundingBox", engine: "dom" }, signal);
  if (!result.success || !result.data || typeof result.data !== "object" || Array.isArray(result.data)) {
    throw executionError(result.error?.message || "Unable to resolve the exact target path.", result.error?.code === "TARGET_RESOLUTION_FAILED");
  }
  const path = (result.data as unknown as ViewportBounds).path;
  if (!Array.isArray(path)) throw new Error("The content engine did not return an exact target path.");
  return path;
};

export const resolveBounds = async (request: ActionRequest, tabId: number, signal?: AbortSignal): Promise<ViewportBounds> => {
  if (request.target?.x !== undefined || request.target?.y !== undefined) return coordinateBounds(request, tabId, signal);
  const result = await executeContentAction({ ...request, action: "getBoundingBox", engine: "dom", params: { ...request.params, actionable: true } }, signal);
  if (!result.success || !result.data || typeof result.data !== "object" || Array.isArray(result.data)) {
    throw executionError(result.error?.message || "Unable to resolve target coordinates.", result.error?.code === "TARGET_RESOLUTION_FAILED");
  }
  const bounds = result.data as unknown as ViewportBounds;
  if (![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)) throw new Error("The target returned invalid viewport bounds.");
  return translateFrameBounds(request, tabId, bounds, signal);
};

export const resolvePoint = async (request: ActionRequest, tabId: number, signal?: AbortSignal): Promise<ViewportPoint> => {
  const bounds = await resolveBounds(request, tabId, signal);
  return { x: bounds.hitX ?? bounds.x + bounds.width / 2, y: bounds.hitY ?? bounds.y + bounds.height / 2 };
};
