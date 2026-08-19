import { ensureDebugger, sendAttachedDebuggerCommand, sendDebuggerCommand } from "./debugger-session";
import { resolveKey } from "./key-map";
import { executionError } from "../actions/execution-error.js";
import { holdModifier, isHeldKey, normalizeHeldKey, releaseModifier, takeHeldKeys } from "./held-modifiers.js";
import { modifierMask } from "./modifiers.js";

const keyEvent = (type: "keyDown" | "keyUp", value: string, modifiers = 0, autoRepeat = false) => {
  const definition = resolveKey(value);
  const text = type === "keyDown" && (modifiers & 7) === 0 ? definition.text : undefined;
  return {
    type,
    key: definition.key,
    code: definition.code,
    text,
    unmodifiedText: text,
    windowsVirtualKeyCode: definition.keyCode,
    nativeVirtualKeyCode: definition.keyCode,
    location: definition.location,
    isKeypad: definition.isKeypad,
    modifiers,
    autoRepeat,
  };
};

export const dispatchKey = (tabId: number, type: "keyDown" | "keyUp", value: string, modifiers = 0, autoRepeat = false) =>
  sendDebuggerCommand(tabId, "Input.dispatchKeyEvent", keyEvent(type, value, modifiers, autoRepeat));

export const dispatchAttachedKey = (tabId: number, type: "keyDown" | "keyUp", value: string, modifiers = 0) =>
  sendAttachedDebuggerCommand(tabId, "Input.dispatchKeyEvent", keyEvent(type, value, modifiers));

export const acquireKey = async (tabId: number, value: string, modifiers: number, rejectHeld = false, signal?: AbortSignal) => {
  const normalized = normalizeHeldKey(value);
  if (isHeldKey(tabId, normalized)) {
    if (rejectHeld) throw executionError(`Key "${value}" is already held.`);
    await dispatchKey(tabId, "keyDown", normalized, modifiers, true);
    signal?.throwIfAborted();
    return normalized;
  }
  await ensureDebugger(tabId);
  holdModifier(tabId, normalized);
  try { await dispatchAttachedKey(tabId, "keyDown", normalized, modifiers); signal?.throwIfAborted(); }
  catch (error) {
    const released = await dispatchAttachedKey(tabId, "keyUp", normalized, modifiers & ~modifierMask([normalized])).then(() => true, () => false);
    released && releaseModifier(tabId, normalized);
    throw error;
  }
  return normalized;
};

export const releaseKey = async (tabId: number, value: string, modifiers: number) => {
  const normalized = normalizeHeldKey(value);
  try { await dispatchKey(tabId, "keyUp", normalized, modifiers); }
  catch (error) {
    const released = await dispatchKey(tabId, "keyUp", normalized, modifiers).then(() => true, () => false);
    released && releaseModifier(tabId, normalized);
    throw error;
  }
  releaseModifier(tabId, normalized);
};

export const pressKey = async (tabId: number, value: string, modifiers = 0, signal?: AbortSignal) => {
  const normalized = normalizeHeldKey(value);
  const keyMask = modifierMask([normalized]);
  await acquireKey(tabId, normalized, modifiers | keyMask, true, signal);
  await releaseKey(tabId, normalized, modifiers & ~keyMask);
};

export const releaseHeldKeys = async () => {
  await Promise.allSettled(takeHeldKeys().map(async ({ tabId, keys }) => {
    let mask = modifierMask(keys);
    for (const value of keys.reverse()) {
      const nextMask = mask & ~modifierMask([value]);
      const released = await dispatchAttachedKey(tabId, "keyUp", value, nextMask).then(() => true, () => false);
      if (released) { mask = nextMask; releaseModifier(tabId, value); }
    }
  }));
};
