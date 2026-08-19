import type { ActionRequest } from "../types/action.js";
import { DEFAULT_MOUSE_SPEED } from "./constants.js";
import { mouse } from "./nativeMouseAdapter.js";
import { nativeInputDuration } from "./nativeInputLimits.js";
import { assertNoNativeWebTarget, numberParam, optionalRequestPoint, requestPoint } from "./nativeParams.js";
import { throwIfAborted } from "./nativeError.js";

export const configureNativeMouse = (request: ActionRequest) => {
  mouse.config.mouseSpeed = numberParam(request, "speed") ?? DEFAULT_MOUSE_SPEED;
  mouse.config.autoDelayMs = numberParam(request, "delayMs") ?? 0;
};

export const moveNativePointer = async (
  request: ActionRequest,
  signal: AbortSignal,
  prefix = "",
) => {
  assertNoNativeWebTarget(request);
  const point = requestPoint(request, prefix);
  return moveNativeScreenPoint(request, point, signal);
};

export const moveNativeScreenPoint = async (
  request: ActionRequest,
  point: { x: number; y: number },
  signal: AbortSignal,
) => {
  throwIfAborted(signal);
  const durationValue = request.params?.durationMs;
  const durationMs = durationValue === undefined || durationValue === null
    ? undefined : nativeInputDuration(durationValue, 0, "Pointer durationMs");
  configureNativeMouse(request);
  const target = { x: Math.round(point.x), y: Math.round(point.y) };
  if (durationMs && durationMs > 0 && numberParam(request, "speed") === undefined) {
    const current = await mouse.getPosition();
    mouse.config.mouseSpeed = Math.max(1, Math.hypot(target.x - current.x, target.y - current.y) * 1000 / durationMs);
  }
  durationMs === 0
    ? await mouse.setPosition(target)
    : await mouse.move(target, signal);
  throwIfAborted(signal);
  return { x: target.x, y: target.y };
};

export const moveNativePointerWhenProvided = async (
  request: ActionRequest,
  signal: AbortSignal,
) => {
  assertNoNativeWebTarget(request);
  return optionalRequestPoint(request) ? moveNativePointer(request, signal) : undefined;
};
