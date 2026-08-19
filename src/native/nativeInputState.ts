import type { NativeButton } from "./nativeButtons.js";
import { keyboard } from "./nativeKeyboardAdapter.js";
import { resolveTextKeys, type NativeKey } from "./nativeKeys.js";
import { mouse } from "./nativeMouseAdapter.js";

const heldKeys = new Set<NativeKey>();
const heldButtons = new Set<NativeButton>();
let latestButton: NativeButton | undefined;
type NativeDrag = { button: NativeButton; modifiers: NativeKey[]; buttonHeld: boolean };
let drag: NativeDrag | undefined;
const RELEASE_ATTEMPTS = 3;

export const pressNativeKeys = async (keys: readonly NativeKey[]) => {
  await keyboard.pressKey(...keys);
  keys.forEach((key) => {
    heldKeys.delete(key);
    heldKeys.add(key);
  });
};
export const acquireNativeKeys = async (keys: readonly NativeKey[]) => {
  const owned = [...new Set(keys)].filter((key) => !heldKeys.has(key));
  if (!owned.length) return owned;
  try { await pressNativeKeys(owned); }
  catch (error) {
    owned.forEach((key) => heldKeys.add(key));
    await releaseNativeKeys(owned).catch(() => undefined);
    throw error;
  }
  return owned;
};

export const releaseNativeKeys = async (keys: readonly NativeKey[]) => {
  await keyboard.releaseKey(...keys);
  keys.forEach((key) => heldKeys.delete(key));
  if (drag) drag.modifiers = drag.modifiers.filter((key) => !keys.includes(key));
};

export const pressNativeButton = async (button: NativeButton) => {
  await mouse.pressButton(button);
  heldButtons.delete(button);
  heldButtons.add(button);
  latestButton = button;
};

export const releaseNativeButton = async (button: NativeButton) => {
  await mouse.releaseButton(button);
  heldButtons.delete(button);
  if (latestButton === button) latestButton = [...heldButtons].at(-1);
  if (drag?.button === button) drag.buttonHeld = false;
};

export const heldNativeButton = () => latestButton || (drag?.buttonHeld ? drag.button : undefined);
export const isNativeButtonHeld = (button: NativeButton) => heldButtons.has(button) || drag?.buttonHeld === true && drag.button === button;
export const assertNativeKeyAvailable = (key?: NativeKey) => {
  if (key && heldKeys.has(key)) throw new Error(`Native key "${key.code}" is already held.`);
};
export const assertNativeTextKeysAvailable = (value: string) => resolveTextKeys(value).forEach(assertNativeKeyAvailable);
export const tapNativeKeys = async (keys: readonly NativeKey[]) => {
  assertNativeKeyAvailable(keys.at(-1));
  const owned = await acquireNativeKeys(keys);
  if (owned.length) await releaseNativeKeys(owned);
};
export const activeNativeDrag = () => drag;
export const beginNativeDrag = (button: NativeButton, modifiers: NativeKey[]) => {
  drag = { button, modifiers: [...modifiers], buttonHeld: false };
  return drag;
};
export const releaseNativeDrag = async () => {
  if (!drag) return;
  if (drag.buttonHeld) {
    await releaseNativeButton(drag.button);
    drag.buttonHeld = false;
  }
  if (drag.modifiers.length) {
    await releaseNativeKeys(drag.modifiers);
    drag.modifiers = [];
  }
  drag = undefined;
};
export const clearNativeDrag = () => { drag = undefined; };

const releaseInputPass = async () => {
  const failures: unknown[] = [];
  const buttons = new Set([...heldButtons, ...(drag?.buttonHeld ? [drag.button] : [])]);
  const keys = new Set([...heldKeys, ...(drag?.modifiers || [])]);
  for (const button of buttons) await releaseNativeButton(button).catch((error: unknown) => failures.push(error));
  for (const key of [...keys].reverse()) await releaseNativeKeys([key]).catch((error: unknown) => failures.push(error));
  if (drag && !drag.buttonHeld && drag.modifiers.length === 0) drag = undefined;
  return failures;
};
export const releaseAllNativeInput = async () => {
  let failures: unknown[] = [];
  for (let attempt = 1; attempt <= RELEASE_ATTEMPTS; attempt += 1) {
    failures = await releaseInputPass();
    if (failures.length === 0) return;
    if (attempt < RELEASE_ATTEMPTS) await new Promise<void>((resolve) => setTimeout(resolve, attempt * 25));
  }
  const detail = failures.map((error) => error instanceof Error ? error.message : String(error)).join("; ");
  throw new Error(`Native input cleanup failed after ${RELEASE_ATTEMPTS} attempts${detail ? `: ${detail}` : "."}`);
};
