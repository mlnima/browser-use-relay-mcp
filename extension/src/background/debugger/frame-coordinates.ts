import type { ActionRequest } from "../../../../src/types/action.js";
import { executeContentAction } from "../actions/content-transport";
import { sendDebuggerCommand } from "./debugger-session";
import { resolveCdpFrame } from "./resolve-cdp-frame";
import type { ViewportBounds, ViewportPoint } from "./resolve-point";
import { scrollFrameChainIntoView } from "./scroll-frame-chain";

type BoxModel = { model: { content: number[] } };
type LocatedNode = { frameId?: string };
type PageState = { viewport?: { width?: number; height?: number } };
type LayoutMetrics = { layoutViewport: { clientWidth: number; clientHeight: number } };

export const resolveBrowserFrameId = async (request: ActionRequest, tabId: number) => {
  if (typeof request.target?.frameId === "number" && !request.target.documentId) return request.target.frameId;
  if (!request.target?.documentId) return 0;
  const frames = await chrome.webNavigation.getAllFrames({ tabId }) || [];
  const frame = frames.find(({ documentId }) => documentId === request.target?.documentId);
  if (!frame) throw new Error(`Unable to resolve document ${request.target.documentId} to a browser frame.`);
  if (typeof request.target.frameId === "number" && request.target.frameId !== frame.frameId) throw new Error("The target frame ID and document ID refer to different documents.");
  return frame.frameId;
};

export const readFrameViewport = async (request: ActionRequest, signal?: AbortSignal) => {
  const result = await executeContentAction({ ...request, action: "getPageState", engine: "dom" }, signal);
  if (!result.success || !result.data || typeof result.data !== "object" || Array.isArray(result.data)) {
    throw new Error(result.error?.message || "Unable to read the target frame viewport.");
  }
  const viewport = (result.data as PageState).viewport;
  if (!viewport?.width || !viewport.height) throw new Error("The target frame has no usable viewport.");
  return { width: viewport.width, height: viewport.height };
};

const mapPoint = (point: ViewportPoint, quad: number[], viewport: { width: number; height: number }) => {
  const u = point.x / viewport.width;
  const v = point.y / viewport.height;
  const x = (1 - u) * (1 - v) * quad[0] + u * (1 - v) * quad[2] + u * v * quad[4] + (1 - u) * v * quad[6];
  const y = (1 - u) * (1 - v) * quad[1] + u * (1 - v) * quad[3] + u * v * quad[5] + (1 - u) * v * quad[7];
  return { x, y };
};

const mapBounds = (bounds: ViewportBounds, quad: number[], viewport: { width: number; height: number }): ViewportBounds => {
  const corners = [
    mapPoint(bounds, quad, viewport),
    mapPoint({ x: bounds.x + bounds.width, y: bounds.y }, quad, viewport),
    mapPoint({ x: bounds.x + bounds.width, y: bounds.y + bounds.height }, quad, viewport),
    mapPoint({ x: bounds.x, y: bounds.y + bounds.height }, quad, viewport),
  ];
  const xs = corners.map(({ x }) => x);
  const ys = corners.map(({ y }) => y);
  const hit = mapPoint({ x: bounds.hitX ?? bounds.x + bounds.width / 2, y: bounds.hitY ?? bounds.y + bounds.height / 2 }, quad, viewport);
  return { ...bounds, x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys), hitX: hit.x, hitY: hit.y };
};

export const translateFrameBounds = async (request: ActionRequest, tabId: number, bounds: ViewportBounds, signal?: AbortSignal, suppliedViewport?: { width: number; height: number }) => {
  const frameId = await resolveBrowserFrameId(request, tabId);
  if (frameId === 0) return bounds;
  const cdpFrameId = await resolveCdpFrame(tabId, frameId);
  const owner = await scrollFrameChainIntoView(tabId, cdpFrameId, signal);
  signal?.throwIfAborted();
  const [{ model }, viewport, metrics] = await Promise.all([
    sendDebuggerCommand<BoxModel>(tabId, "DOM.getBoxModel", { backendNodeId: owner.backendNodeId }),
    suppliedViewport || readFrameViewport(request, signal),
    sendDebuggerCommand<LayoutMetrics>(tabId, "Page.getLayoutMetrics"),
  ]);
  if (model.content.length !== 8 || !model.content.every(Number.isFinite)) throw new Error("The target frame has no rendered content box.");
  const translated = mapBounds(bounds, model.content, viewport);
  const pointOnly = bounds.width === 0 && bounds.height === 0;
  if (!pointOnly && (translated.width <= 0 || translated.height <= 0)) throw new Error("The target frame is hidden or has a zero-size rendered box.");
  const hitPoint = { x: translated.hitX!, y: translated.hitY! };
  if (hitPoint.x < 0 || hitPoint.y < 0 || hitPoint.x >= metrics.layoutViewport.clientWidth || hitPoint.y >= metrics.layoutViewport.clientHeight) {
    throw new Error("The target frame is outside the top-frame viewport.");
  }
  const hit = await sendDebuggerCommand<LocatedNode>(tabId, "DOM.getNodeForLocation", { x: Math.round(hitPoint.x), y: Math.round(hitPoint.y), includeUserAgentShadowDOM: true });
  if (hit.frameId !== cdpFrameId) throw new Error("The target frame is outside the top viewport, covered, or unavailable.");
  return translated;
};
