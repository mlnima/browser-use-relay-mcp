import type { ActionRequest } from "../../../../src/types/action.js";
import { abortableDelay, assertInputDuration, inputCount, inputDuration } from "./abortable-delay";
import { resolvePoint, type ViewportPoint } from "./resolve-point";
import { animateTouch, pinchTouch, tapTouch } from "./touch-gestures";
import { acquireTouchPoints, activeTouchPoints, clearTouchPoints, dispatchAttachedTouch, dispatchTouch, takeActiveTouches, touchPointsFrom, trackTouchPoints, type TouchPoint } from "./touch-points";

const touchActions = new Set(["tap", "doubleTap", "longTap", "touchStart", "touchMove", "touchEnd", "touchCancel", "swipe", "pinchIn", "pinchOut", "multiTouch"]);

export const cancelHeldTouches = async () => {
  await Promise.allSettled(takeActiveTouches().map(async (tabId) => {
    await dispatchAttachedTouch(tabId, "touchCancel", []); clearTouchPoints(tabId);
  }));
};

const centerFor = async (request: ActionRequest, tabId: number, signal?: AbortSignal): Promise<ViewportPoint> => {
  if (request.target) return resolvePoint(request, tabId, signal);
  const current = activeTouchPoints(tabId)?.[0];
  const x = request.params?.toX ?? current?.x;
  const y = request.params?.toY ?? current?.y;
  if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) throw new Error("A finite touch target or active touch sequence is required.");
  return { x, y };
};

const shiftedPoints = (points: TouchPoint[], center: ViewportPoint) => {
  if (!points[0]) throw new Error("An active touch sequence has no touch points.");
  const offsetX = center.x - points[0].x;
  const offsetY = center.y - points[0].y;
  return points.map((item) => ({ ...item, x: item.x + offsetX, y: item.y + offsetY }));
};

export const executeTouchInput = async (request: ActionRequest, tabId: number, signal?: AbortSignal) => {
  if (!touchActions.has(request.action)) return undefined;
  const held = activeTouchPoints(tabId);
  if (request.action === "touchEnd" || request.action === "touchCancel") {
    if (!held) throw new Error("No active touch sequence is available to release.");
    await dispatchTouch(tabId, request.action, [], request);
    clearTouchPoints(tabId); return true;
  }
  if (request.action === "touchMove" ? !held : Boolean(held)) throw new Error(request.action === "touchMove" ? "No active touch sequence is available to move." : "A touch sequence is already active.");
  const center = await centerFor(request, tabId, signal);
  if (request.action === "swipe") {
    const end = await resolvePoint({ ...request, target: { tabId, frameId: request.target?.frameId, documentId: request.target?.documentId, x: Number(request.params?.toX ?? center.x), y: Number(request.params?.toY ?? center.y) } }, tabId, signal);
    return (await animateTouch(request, tabId, center, end, signal), end);
  }
  if (request.action === "pinchIn" || request.action === "pinchOut") return (await pinchTouch(request, tabId, center, request.action === "pinchIn", signal), true);
  const moveCenter = request.action === "touchMove" && (request.params?.toX !== undefined || request.params?.toY !== undefined)
    ? await resolvePoint({ ...request, target: { tabId, frameId: request.target?.frameId, documentId: request.target?.documentId, x: Number(request.params?.toX ?? center.x), y: Number(request.params?.toY ?? center.y) } }, tabId, signal)
    : center;
  const current = held;
  const points = request.action === "touchMove" && !request.params?.points && current ? shiftedPoints(current, moveCenter) : touchPointsFrom(request, moveCenter);
  if (points.length === 0) throw new Error("At least one touch point is required.");
  if (request.action === "touchMove") return (trackTouchPoints(tabId, points), await dispatchTouch(tabId, "touchMove", points, request), points);
  if (request.action === "touchStart") return (await acquireTouchPoints(tabId, points, request, signal), points);
  if (request.action === "longTap") return tapTouch(request, tabId, center, inputDuration(request.params?.durationMs, 750, "durationMs"), signal);
  if (request.action === "multiTouch") {
    const sourceMoves = request.params?.moves;
    if (sourceMoves !== undefined && !Array.isArray(sourceMoves)) throw new Error("moves must be an array.");
    const moves = sourceMoves || [];
    inputCount(moves.length, 0, "moves", 0);
    const duration = inputDuration(request.params?.durationMs, 300, "durationMs");
    const interval = inputDuration(request.params?.intervalMs, duration / Math.max(1, moves.length), "intervalMs");
    assertInputDuration(interval * moves.length, "Multi-touch duration");
    const sequences = moves.map((move) => {
      const value = move && typeof move === "object" && !Array.isArray(move) && Array.isArray(move.points) ? move.points : move;
      return touchPointsFrom(request, center, value);
    });
    if (sequences.some((next) => next.length === 0)) throw new Error("Each multi-touch move requires at least one touch point.");
    await acquireTouchPoints(tabId, points, request, signal);
    try {
      for (const next of sequences) {
        signal?.throwIfAborted();
        trackTouchPoints(tabId, next);
        await dispatchTouch(tabId, "touchMove", next, request);
        if (interval > 0) await abortableDelay(interval, signal);
      }
    } finally {
      await dispatchTouch(tabId, "touchEnd", [], request);
      clearTouchPoints(tabId);
    }
    return points;
  }
  const tapInterval = request.action === "doubleTap" ? inputDuration(request.params?.tapIntervalMs, 100, "tapIntervalMs") : 0;
  await tapTouch(request, tabId, center, 0, signal);
  if (request.action === "doubleTap") {
    await abortableDelay(tapInterval, signal);
    await tapTouch(request, tabId, center, 0, signal);
  }
  return points;
};
