import { nativeBinding } from "./nativeBinding.js";
import type { NativeKey } from "./nativeKeys.js";
import { assertNativePageKeys, nativePageKeysPressed, nativePageKeysReleased } from "./page/nativePageScope.js";

const keyCodes = (keys: readonly NativeKey[]) => keys.map((key) => key.code);
const tapKeys = (keys: readonly NativeKey[]) => {
  assertNativePageKeys(keyCodes(keys));
  const reversed = [...keys].reverse();
  const key = reversed[0];
  if (!key) return;
  const modifiers = keyCodes(reversed.slice(1));
  nativeBinding().keyTap(key.code, modifiers);
};
const toggleKeys = (keys: readonly NativeKey[], direction: "down" | "up") => {
  if (direction === "down") assertNativePageKeys(keyCodes(keys));
  const reversed = [...keys].reverse();
  const key = reversed[0];
  if (!key) return;
  const modifiers = keyCodes(reversed.slice(1));
  nativeBinding().keyToggle(key.code, direction, modifiers);
  direction === "down" ? nativePageKeysPressed(keyCodes(keys)) : nativePageKeysReleased(keyCodes(keys));
};

export const keyboard = {
  config: { autoDelayMs: 0 },
  type: async (...input: Array<string | NativeKey>) => {
    if (input.some((value) => typeof value === "string" && value.includes("\t"))) throw new Error("Native Tab input can leave the webpage.");
    assertNativePageKeys([], input.every((value) => typeof value === "string"));
    const raw = nativeBinding();
    raw.setKeyboardDelay(0);
    input.every((value) => typeof value === "string")
      ? raw.typeString((input as string[]).join(" "))
      : tapKeys(input as NativeKey[]);
  },
  pressKey: async (...keys: NativeKey[]) => {
    nativeBinding().setKeyboardDelay(0);
    toggleKeys(keys, "down");
  },
  releaseKey: async (...keys: NativeKey[]) => {
    nativeBinding().setKeyboardDelay(0);
    toggleKeys(keys, "up");
  },
};
