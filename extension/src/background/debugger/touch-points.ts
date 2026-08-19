import type { ActionRequest } from "../../../../src/types/action.js";
import type { JsonValue } from "../../../../src/types/json.js";
import { MAX_INPUT_TOUCH_POINTS } from "../../../../src/protocol/limits.js";
import { inputNumber } from "./abortable-delay.js";
import { ensureDebugger, sendAttachedDebuggerCommand, sendDebuggerCommand } from "./debugger-session";
import { heldModifierMask } from "./held-modifiers";
import { modifierMask } from "./modifiers";
import type { ViewportPoint } from "./resolve-point";

export type TouchPoint = Record<string, number> & { x: number; y: number; id: number };
const active = new Map<number, TouchPoint[]>();
const clearState = (tabId?: number) => tabId !== undefined && active.delete(tabId);
chrome.debugger.onDetach.addListener((source) => clearState(source.tabId));
chrome.webNavigation.onCommitted.addListener((details) => details.frameId === 0 && clearState(details.tabId));
export const activeTouchPoints = (tabId: number) => active.get(tabId);
export const trackTouchPoints = (tabId: number, points: TouchPoint[]) => active.set(tabId, points);
export const clearTouchPoints = (tabId: number) => active.delete(tabId);
export const takeActiveTouches = () => [...active.keys()];

export const touchPoint = (request: ActionRequest, x: number, y: number, id: number): TouchPoint => ({
  x,
  y,
  id,
  radiusX: inputNumber(request.params?.radiusX, 1, "radiusX"),
  radiusY: inputNumber(request.params?.radiusY, 1, "radiusY"),
  force: inputNumber(request.params?.pressure, 1, "pressure"),
  tangentialPressure: inputNumber(request.params?.tangentialPressure, 0, "tangentialPressure"),
  tiltX: inputNumber(request.params?.tiltX, 0, "tiltX"),
  tiltY: inputNumber(request.params?.tiltY, 0, "tiltY"),
  twist: inputNumber(request.params?.twist, 0, "twist"),
});

export const touchPointsFrom = (request: ActionRequest, center: ViewportPoint, value: JsonValue | undefined = request.params?.points) => {
  if (!Array.isArray(value)) return [touchPoint(request, center.x, center.y, 0)];
  if (value.length > MAX_INPUT_TOUCH_POINTS) throw new Error(`Touch points cannot exceed ${MAX_INPUT_TOUCH_POINTS}.`);
  return value.map((item, index) => {
    const raw = item && typeof item === "object" && !Array.isArray(item) ? item : {};
    return touchPoint(request, inputNumber(raw.x, center.x, "touch x"), inputNumber(raw.y, center.y, "touch y"), inputNumber(raw.id, index, "touch id"));
  });
};

export const dispatchTouch = (tabId: number, type: string, points: TouchPoint[], request: ActionRequest) =>
  sendDebuggerCommand(tabId, "Input.dispatchTouchEvent", {
    type, touchPoints: points, modifiers: modifierMask(request.params?.modifiers) | heldModifierMask(tabId),
  });
export const acquireTouchPoints = async (tabId: number, points: TouchPoint[], request: ActionRequest, signal?: AbortSignal) => {
  await ensureDebugger(tabId); trackTouchPoints(tabId, points);
  try { await dispatchTouch(tabId, "touchStart", points, request); signal?.throwIfAborted(); }
  catch (error) {
    const cancelled = await dispatchTouch(tabId, "touchCancel", [], request).then(() => true, () => false);
    if (cancelled) clearTouchPoints(tabId);
    throw error;
  }
};

export const dispatchAttachedTouch = (tabId: number, type: string, points: TouchPoint[]) =>
  sendAttachedDebuggerCommand(tabId, "Input.dispatchTouchEvent", { type, touchPoints: points, modifiers: heldModifierMask(tabId) });
