import type { ActionRequest } from "../types/action.js";
import type { JsonValue } from "../types/json.js";
import { createNativeError, throwIfAborted } from "./nativeError.js";
import { assertNativeKeyAvailable, tapNativeKeys } from "./nativeInputState.js";
import { nativeInputCount, nativeInputDuration, nativeInputNumber } from "./nativeInputLimits.js";
import { platformModifier, resolveKey } from "./nativeKeys.js";
import { mouse } from "./nativeMouseAdapter.js";
import { assertNoNativeWebTarget } from "./nativeParams.js";
import { moveNativeScreenPoint } from "./nativeMouse.js";

const directional = new Set(["scrollUp", "scrollDown", "scrollLeft", "scrollRight"]);
const vectors = new Set(["scrollBy", "scrollElement", "wheel"]);
const ticks = (value: number, size: number, label: string) => {
  const count = Math.ceil(Math.abs(value) / size);
  return value === 0 ? 0 : nativeInputCount(count, count, label);
};

const scrollAxis = async (x: number, y: number, xTicks: number, yTicks: number) => {
  if (y > 0) await mouse.scrollDown(yTicks);
  if (y < 0) await mouse.scrollUp(yTicks);
  if (x > 0) await mouse.scrollRight(xTicks);
  if (x < 0) await mouse.scrollLeft(xTicks);
};

const scrollTarget = (request: ActionRequest) => {
  const x = request.target?.x;
  const y = request.target?.y;
  if (x === undefined && y === undefined) return;
  if (typeof x !== "number" || !Number.isFinite(x) || typeof y !== "number" || !Number.isFinite(y))
    throw createNativeError("NATIVE_COORDINATES_REQUIRED", "Scroll target screen coordinates are incomplete.");
  return { x, y };
};

export const executeNativeScroll = async (
  request: ActionRequest,
  signal: AbortSignal,
): Promise<JsonValue | undefined> => {
  throwIfAborted(signal);
  assertNoNativeWebTarget(request);
  const durationValue = request.params?.durationMs;
  if (durationValue !== undefined && durationValue !== null) nativeInputDuration(durationValue, 0, "Scroll durationMs");
  if (request.params?.steps !== undefined) nativeInputCount(request.params.steps, 1, "Scroll steps");
  const target = scrollTarget(request);
  const amount = directional.has(request.action)
    ? nativeInputCount(request.params?.amount, 3, "Scroll amount") : 0;
  const vector = vectors.has(request.action);
  const x = vector ? nativeInputNumber(request.params?.x ?? request.params?.deltaX, 0, "Scroll deltaX") : 0;
  const y = vector ? nativeInputNumber(request.params?.y ?? request.params?.deltaY, 0, "Scroll deltaY") : 0;
  const stepSize = vector ? nativeInputNumber(request.params?.stepSize, 100, "Scroll stepSize") : 100;
  if (stepSize <= 0)
    throw createNativeError("INVALID_NATIVE_PARAMETERS", "Scroll stepSize must be greater than zero.");
  const xTicks = ticks(x, stepSize, "Horizontal native scroll ticks");
  const yTicks = ticks(y, stepSize, "Vertical native scroll ticks");
  const trigger = request.action === "scrollToTop" ? resolveKey("Home")
    : request.action === "scrollToBottom" ? resolveKey("End") : undefined;
  assertNativeKeyAvailable(trigger);
  if (request.action === "scrollElement" && (!target || x === 0 && y === 0))
    throw createNativeError("INVALID_NATIVE_PARAMETERS", "Native scrollElement requires a screen target and a nonzero x or y delta.");
  if (target) await moveNativeScreenPoint(request, target, signal);
  switch (request.action) {
    case "scrollUp": await mouse.scrollUp(amount); break;
    case "scrollDown": await mouse.scrollDown(amount); break;
    case "scrollLeft": await mouse.scrollLeft(amount); break;
    case "scrollRight": await mouse.scrollRight(amount); break;
    case "scrollToTop": case "scrollToBottom": await tapNativeKeys([platformModifier(), trigger!]); break;
    default: await scrollAxis(x, y, xTicks, yTicks);
  }
  throwIfAborted(signal);
  return { deltaX: x, deltaY: y };
};
