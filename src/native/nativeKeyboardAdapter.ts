import { nativeBinding } from "./nativeBinding.js";
import type { NativeKey } from "./nativeKeys.js";

const keyCodes = (keys: readonly NativeKey[]) => keys.map((key) => key.code);
const tapKeys = (keys: readonly NativeKey[]) => {
  const reversed = [...keys].reverse();
  const key = reversed[0];
  if (!key) return;
  const modifiers = keyCodes(reversed.slice(1));
  nativeBinding().keyTap(key.code, modifiers.length ? modifiers : undefined);
};
const toggleKeys = (keys: readonly NativeKey[], direction: "down" | "up") => {
  const reversed = [...keys].reverse();
  const key = reversed[0];
  if (!key) return;
  const modifiers = keyCodes(reversed.slice(1));
  nativeBinding().keyToggle(key.code, direction, modifiers.length ? modifiers : undefined);
};

export const keyboard = {
  config: { autoDelayMs: 0 },
  type: async (...input: Array<string | NativeKey>) => {
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
