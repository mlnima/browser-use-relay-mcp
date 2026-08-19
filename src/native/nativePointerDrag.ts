import type { ActionRequest } from "../types/action.js";
import type { JsonValue } from "../types/json.js";
import { createNativeError, throwIfAborted } from "./nativeError.js";
import { resolveButton } from "./nativeButtons.js";
import { acquireNativeKeys, activeNativeDrag, beginNativeDrag, clearNativeDrag, heldNativeButton, isNativeButtonHeld, pressNativeButton, releaseNativeButton, releaseNativeDrag, releaseNativeKeys } from "./nativeInputState.js";
import { assertNativeInputDuration, nativeInputDuration } from "./nativeInputLimits.js";
import { requestModifierKeys } from "./nativeModifiers.js";
import { assertNoNativeWebTarget, objectParam, optionalRequestPoint } from "./nativeParams.js";
import { moveNativeScreenPoint } from "./nativeMouse.js";
import { mouse } from "./nativeMouseAdapter.js";
const buttonFor = (request: ActionRequest) => {
  const requested = request.params?.button;
  if (requested !== undefined && typeof requested !== "string")
    throw createNativeError("INVALID_NATIVE_PARAMETERS", "Drag button must be a string.");
  return resolveButton(requested ?? "left");
}; export const resetNativeDragState = () => clearNativeDrag();
const pointFromObject = (request: ActionRequest) => {
  const destination = objectParam(request, "destination");
  const x = destination?.x;
  const y = destination?.y;
  if (destination && Object.keys(destination).every((key) => ["x", "y"].includes(key)) &&
    typeof x === "number" && Number.isFinite(x) && typeof y === "number" && Number.isFinite(y)) return { x, y };
  if (request.params?.destination !== undefined)
    throw createNativeError("NATIVE_COORDINATES_REQUIRED", "Native drag destinations support only complete screen coordinates.");
  return undefined;
};
const completeDrag = async (request: ActionRequest, button: ReturnType<typeof resolveButton>, modifiers: ReturnType<typeof requestModifierKeys>, source: { x: number; y: number }, destination: { x: number; y: number }, signal: AbortSignal) => {
  const durationValue = request.params?.durationMs;
  const durationMs = durationValue === undefined || durationValue === null
    ? 0 : nativeInputDuration(durationValue, 0, "Drag durationMs");
  assertNativeInputDuration(durationMs * 2, "Native drag duration");
  if (isNativeButtonHeld(button)) throw createNativeError("NATIVE_BUTTON_HELD", `Native pointer button "${button}" is already held.`);
  await moveNativeScreenPoint(request, source, signal);
  const ownedModifiers = await acquireNativeKeys(modifiers);
  try {
    await pressNativeButton(button);
    try {
      await moveNativeScreenPoint(request, destination, signal);
      throwIfAborted(signal);
    } finally {
      await releaseNativeButton(button);
    }
  } finally {
    if (ownedModifiers.length) await releaseNativeKeys(ownedModifiers);
  }
};
const requireActiveDrag = () => {
  const drag = activeNativeDrag();
  if (!drag) throw createNativeError("NATIVE_DRAG_INACTIVE", "No native drag is active.");
  return drag;
};
const startDrag = async (request: ActionRequest, button: ReturnType<typeof resolveButton>, modifiers: ReturnType<typeof requestModifierKeys>, point: { x: number; y: number } | undefined, signal: AbortSignal) => {
  if (activeNativeDrag() || heldNativeButton() !== undefined)
    throw createNativeError("NATIVE_DRAG_ACTIVE", "A native pointer button is already held.");
  if (point) await moveNativeScreenPoint(request, point, signal);
  const drag = beginNativeDrag(button, []);
  try {
    drag.modifiers = await acquireNativeKeys(modifiers);
    drag.buttonHeld = true;
    await pressNativeButton(drag.button);
    throwIfAborted(signal);
  } catch (error) {
    await releaseNativeDrag().catch(() => undefined);
    throw error;
  }
};
export const executeNativePointerDrag = async (
  request: ActionRequest,
  signal: AbortSignal,
): Promise<JsonValue | undefined> => {
  assertNoNativeWebTarget(request);
  const button = buttonFor(request);
  const modifiers = requestModifierKeys(request);
  const point = optionalRequestPoint(request);
  const from = optionalRequestPoint(request, "from");
  const to = optionalRequestPoint(request, "to");
  const objectDestination = pointFromObject(request);
  if (point && from) throw createNativeError("NATIVE_COORDINATE_CONFLICT", "Drag source accepts either x/y or fromX/fromY.");
  if (to && objectDestination) throw createNativeError("NATIVE_COORDINATE_CONFLICT", "Drag destination accepts either toX/toY or destination.");
  const source = from || point;
  const destination = objectDestination || to;
  const durationValue = request.params?.durationMs;
  if (durationValue !== undefined && durationValue !== null) nativeInputDuration(durationValue, 0, "Drag durationMs");
  switch (request.action) {
    case "dragStart": await startDrag(request, button, modifiers, point, signal); break;
    case "dragMove":
      if (!requireActiveDrag().buttonHeld) throw createNativeError("NATIVE_DRAG_INACTIVE", "The native drag button is not held.");
      if (!point) throw createNativeError("NATIVE_COORDINATES_REQUIRED", "Drag move screen coordinates are required.");
      await moveNativeScreenPoint(request, point, signal); break;
    case "dragEnd":
      if (requireActiveDrag().buttonHeld && point) await moveNativeScreenPoint(request, point, signal);
      await releaseNativeDrag();
      break;
    default:
      if (!source || !destination) throw createNativeError("NATIVE_COORDINATES_REQUIRED", "Complete drag source and destination coordinates are required.");
      await completeDrag(request, button, modifiers, source, destination, signal);
  }
  const position = await mouse.getPosition();
  return { x: position.x, y: position.y };
};
