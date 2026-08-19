import type { ActionRequest } from "../types/action.js";
import { createNativeError } from "./nativeError.js";
import { assertNativeModifierKeys, resolveKeys, splitShortcut } from "./nativeKeys.js";

export const requestModifierKeys = (request: ActionRequest) => {
  const raw = request.params?.modifiers;
  const values = raw === undefined ? [] : typeof raw === "string" ? splitShortcut(raw)
    : Array.isArray(raw) && raw.every((value) => typeof value === "string") ? raw
      : (() => { throw createNativeError("INVALID_NATIVE_MODIFIER", "Native modifiers must be strings."); })();
  const keys = resolveKeys(values);
  assertNativeModifierKeys(keys);
  return keys;
};
