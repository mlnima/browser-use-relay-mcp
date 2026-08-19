import type { ActionRequest } from "../types/action.js";
import type { JsonValue } from "../types/json.js";
import { abortableDelay, createNativeError, throwIfAborted } from "./nativeError.js";
import { resolveButton } from "./nativeButtons.js";
import { acquireNativeKeys, heldNativeButton, isNativeButtonHeld, pressNativeButton, releaseNativeButton, releaseNativeKeys } from "./nativeInputState.js";
import { assertNativeInputDuration, nativeInputDuration } from "./nativeInputLimits.js";
import { assertNativeModifierKeys, platformModifier, resolveKeys, splitShortcut } from "./nativeKeys.js";
import { requestModifierKeys } from "./nativeModifiers.js";
import { optionalRequestPoint, stringParam } from "./nativeParams.js";
import { moveNativePointerWhenProvided } from "./nativeMouse.js";
import { mouse } from "./nativeMouseAdapter.js";

const actionButton = (request: ActionRequest) => {
  const requested = request.params?.button;
  if (requested !== undefined && typeof requested !== "string")
    throw createNativeError("INVALID_NATIVE_PARAMETERS", "Pointer button must be a string.");
  return resolveButton(requested ?? (request.action === "middleClick" ? "middle" :
    ["rightClick", "contextMenu"].includes(request.action) ? "right" : "left"));
};

const clickCount = async (button: ReturnType<typeof resolveButton>, count: number, intervalMs: number, signal: AbortSignal) => {
  for (let index = 0; index < count; index += 1) {
    throwIfAborted(signal);
    await mouse.click(button);
    if (index < count - 1 && intervalMs > 0) await abortableDelay(intervalMs, signal);
  }
};

const holdPointer = async (button: ReturnType<typeof resolveButton>, durationMs: number, signal: AbortSignal) => {
  await pressNativeButton(button);
  try {
    await abortableDelay(durationMs, signal);
  } finally {
    await releaseNativeButton(button);
  }
};

const modifierKeys = (request: ActionRequest, requested: ReturnType<typeof requestModifierKeys>) => {
  const rawKeys = request.params?.keys;
  const rawShortcut = request.params?.shortcut;
  if (rawKeys !== undefined && rawShortcut !== undefined || requested.length && (rawKeys !== undefined || rawShortcut !== undefined))
    throw createNativeError("INVALID_NATIVE_PARAMETERS", "Modifier click accepts one modifier source.");
  const names = rawKeys === undefined ? rawShortcut === undefined ? [] : typeof rawShortcut === "string" ? splitShortcut(rawShortcut)
    : (() => { throw createNativeError("INVALID_NATIVE_PARAMETERS", "Modifier shortcut must be a string."); })()
    : Array.isArray(rawKeys) && rawKeys.every((value) => typeof value === "string") ? rawKeys
      : (() => { throw createNativeError("INVALID_NATIVE_PARAMETERS", "Modifier keys must be strings."); })();
  const keys = requested.length ? requested : names.length ? resolveKeys(names) : [platformModifier()];
  assertNativeModifierKeys(keys);
  return keys;
};
const modifiedActions = new Set(["leftClick", "middleClick", "rightClick", "doubleClick", "tripleClick", "longPress", "contextMenu", "modifierClick"]);

export const executeNativePointerClick = async (
  request: ActionRequest,
  signal: AbortSignal,
): Promise<JsonValue | undefined> => {
  const button = actionButton(request);
  const point = optionalRequestPoint(request);
  const requestedModifiers = requestModifierKeys(request);
  const clickModifiers = request.action === "modifierClick" ? modifierKeys(request, requestedModifiers) : requestedModifiers;
  const durationValue = request.params?.durationMs;
  const requestedMs = durationValue === undefined || durationValue === null
    ? undefined : nativeInputDuration(durationValue, 0, "Pointer durationMs");
  const movementMs = point ? requestedMs || 0 : 0;
  const holdMs = request.action === "longPress" ? requestedMs ?? 750 : 0;
  if (request.action === "longPress" && holdMs === 0)
    throw createNativeError("NATIVE_DURATION_LIMIT", "Long press durationMs must be greater than zero.");
  const clicks = request.action === "doubleClick" ? 2 : request.action === "tripleClick" ? 3 : 1;
  const intervalValue = request.params?.clickIntervalMs;
  const clickIntervalMs = clicks > 1 ? nativeInputDuration(intervalValue, 90, "Click intervalMs")
    : intervalValue === undefined || intervalValue === null ? 0 : nativeInputDuration(intervalValue, 0, "Click intervalMs");
  assertNativeInputDuration(movementMs + holdMs + (clicks - 1) * clickIntervalMs, "Native pointer duration");
  if (!["mouseUp", "release"].includes(request.action) && isNativeButtonHeld(button))
    throw createNativeError("NATIVE_BUTTON_HELD", `Native pointer button "${button}" is already held.`);
  await moveNativePointerWhenProvided(request, signal);
  const applied = modifiedActions.has(request.action) ? request.action === "modifierClick" ? clickModifiers : requestedModifiers : [];
  const owned = await acquireNativeKeys(applied);
  try {
    throwIfAborted(signal);
    switch (request.action) {
      case "mouseDown": case "clickAndHold":
        await pressNativeButton(button);
        try { throwIfAborted(signal); } catch (error) { await releaseNativeButton(button); throw error; }
        break;
      case "mouseUp": case "release":
        await releaseNativeButton(stringParam(request, "button") ? button : heldNativeButton() || button);
        break;
      case "doubleClick": case "tripleClick": await clickCount(button, clicks, clickIntervalMs, signal); break;
      case "longPress": await holdPointer(button, holdMs, signal); break;
      default: await mouse.click(button);
    }
  } finally {
    if (owned.length) await releaseNativeKeys(owned);
  }
  const position = await mouse.getPosition();
  return { x: position.x, y: position.y };
};
