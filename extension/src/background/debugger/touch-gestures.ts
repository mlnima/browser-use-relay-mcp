import type { ActionRequest } from "../../../../src/types/action.js";
import { abortableDelay, inputCount, inputDuration, inputNumber } from "./abortable-delay";
import type { ViewportPoint } from "./resolve-point";
import { acquireTouchPoints, clearTouchPoints, dispatchTouch, touchPoint, trackTouchPoints } from "./touch-points";

export const animateTouch = async (request: ActionRequest, tabId: number, start: ViewportPoint, end: ViewportPoint, signal?: AbortSignal) => {
  const steps = inputCount(request.params?.steps, 20, "steps", 2);
  const duration = inputDuration(request.params?.durationMs, 300, "durationMs");
  signal?.throwIfAborted();
  const initial = [touchPoint(request, start.x, start.y, 0)];
  await acquireTouchPoints(tabId, initial, request, signal);
  try {
    for (let index = 1; index <= steps; index += 1) {
      signal?.throwIfAborted();
      const progress = index / steps;
      const points = [touchPoint(request, start.x + (end.x - start.x) * progress, start.y + (end.y - start.y) * progress, 0)];
      trackTouchPoints(tabId, points);
      await dispatchTouch(tabId, "touchMove", points, request);
      await abortableDelay(duration / steps, signal);
    }
  } finally {
    await dispatchTouch(tabId, "touchEnd", [], request);
    clearTouchPoints(tabId);
  }
};

export const pinchTouch = async (request: ActionRequest, tabId: number, center: ViewportPoint, inward: boolean, signal?: AbortSignal) => {
  const distance = inputNumber(request.params?.distance, 120, "distance");
  const steps = inputCount(request.params?.steps, 12, "steps", 2);
  const duration = inputDuration(request.params?.durationMs, 300, "durationMs");
  const start = inward ? distance : 10;
  const end = inward ? 10 : distance;
  signal?.throwIfAborted();
  const initial = [touchPoint(request, center.x - start, center.y, 0), touchPoint(request, center.x + start, center.y, 1)];
  await acquireTouchPoints(tabId, initial, request, signal);
  try {
    for (let index = 1; index <= steps; index += 1) {
      signal?.throwIfAborted();
      const offset = start + (end - start) * index / steps;
      const points = [touchPoint(request, center.x - offset, center.y, 0), touchPoint(request, center.x + offset, center.y, 1)];
      trackTouchPoints(tabId, points);
      await dispatchTouch(tabId, "touchMove", points, request);
      await abortableDelay(duration / steps, signal);
    }
  } finally {
    await dispatchTouch(tabId, "touchEnd", [], request);
    clearTouchPoints(tabId);
  }
};

export const tapTouch = async (request: ActionRequest, tabId: number, center: ViewportPoint, holdMs = 0, signal?: AbortSignal) => {
  const duration = inputDuration(holdMs, 0, "durationMs");
  const points = [touchPoint(request, center.x, center.y, 0)];
  signal?.throwIfAborted();
  await acquireTouchPoints(tabId, points, request, signal);
  try {
    if (duration > 0) await abortableDelay(duration, signal);
  } finally {
    await dispatchTouch(tabId, "touchEnd", [], request);
    clearTouchPoints(tabId);
  }
  return points;
};
