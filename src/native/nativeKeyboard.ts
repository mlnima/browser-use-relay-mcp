import type { ActionRequest } from "../types/action.js";
import type { JsonValue } from "../types/json.js";
import { DEFAULT_KEY_DELAY_MS, DEFAULT_SLOW_KEY_DELAY_MS } from "./constants.js";
import { abortableDelay, createNativeError, throwIfAborted } from "./nativeError.js";
import { acquireNativeKeys, assertNativeTextKeysAvailable, releaseNativeKeys, tapNativeKeys } from "./nativeInputState.js";
import { assertNativeInputDuration, nativeInputCount, nativeInputDuration, nativeTypingPlan, yieldNativeInput } from "./nativeInputLimits.js";
import { keyboard } from "./nativeKeyboardAdapter.js";
import { assertNativeChordLength, assertNativeModifierKeys, resolveKeys, splitShortcut } from "./nativeKeys.js";
import { requestModifierKeys } from "./nativeModifiers.js";
import { requiredStringParam, stringArrayParam, stringParam, textParam } from "./nativeParams.js";

const requestKeys = (request: ActionRequest) => {
  const names = stringArrayParam(request, "keys") || (
    stringParam(request, "shortcut") ? splitShortcut(requiredStringParam(request, "shortcut")) :
    [requiredStringParam(request, "key")]
  );
  if (!names.length) throw createNativeError("INVALID_NATIVE_PARAMETERS", "At least one native key is required.");
  const namedKeys = resolveKeys(names);
  assertNativeModifierKeys(namedKeys.slice(0, -1));
  const keys = [...new Set([...requestModifierKeys(request), ...namedKeys])];
  assertNativeChordLength(keys.length);
  return keys;
};

export const typeNativeText = async (
  text: string,
  delayMs: number,
  signal: AbortSignal,
  maximumCharacters?: number,
) => {
  const { intervalMs } = nativeTypingPlan(text, delayMs, maximumCharacters);
  assertNativeTextKeysAvailable(text);
  keyboard.config.autoDelayMs = 0;
  const characters = Array.from(text);
  for (let index = 0; index < characters.length; index += 1) {
    await yieldNativeInput(index, signal);
    await keyboard.type(characters[index] || "");
    if (intervalMs > 0 && index < characters.length - 1) await abortableDelay(intervalMs, signal);
  }
  return characters.length;
};

const repeatKey = async (request: ActionRequest, signal: AbortSignal) => {
  const keys = requestKeys(request);
  const count = nativeInputCount(request.params?.count, 1, "Native key repeat count");
  const intervalMs = nativeInputDuration(request.params?.intervalMs, DEFAULT_KEY_DELAY_MS, "Repeat intervalMs");
  assertNativeInputDuration((count - 1) * intervalMs, "Native key-repeat duration");
  for (let index = 0; index < count; index += 1) {
    await yieldNativeInput(index, signal);
    await tapNativeKeys(keys);
    if (intervalMs > 0 && index < count - 1) await abortableDelay(intervalMs, signal);
  }
  return count;
};

export const executeNativeKeyboard = async (
  request: ActionRequest,
  signal: AbortSignal,
): Promise<JsonValue | undefined> => {
  switch (request.action) {
    case "keyDown": case "holdKey": {
      const keys = requestKeys(request);
      const owned = await acquireNativeKeys(keys);
      try {
        throwIfAborted(signal);
      } catch (error) {
        if (owned.length) await releaseNativeKeys(owned);
        throw error;
      }
      return { keys: keys.length };
    }
    case "keyUp": case "releaseKey": {
      const keys = requestKeys(request);
      await releaseNativeKeys(keys);
      return { keys: keys.length };
    }
    case "repeatKey": return { count: await repeatKey(request, signal) };
    case "press": case "shortcut": {
      const keys = requestKeys(request);
      throwIfAborted(signal);
      await tapNativeKeys(keys);
      return { keys: keys.length };
    }
    default: {
      const text = textParam(request, "text");
      const delayMs = nativeInputDuration(request.params?.delayMs ?? request.params?.intervalMs,
        request.action === "typeSlowly" ? DEFAULT_SLOW_KEY_DELAY_MS : DEFAULT_KEY_DELAY_MS, "Typing intervalMs");
      return { characters: await typeNativeText(text, delayMs, signal) };
    }
  }
};
