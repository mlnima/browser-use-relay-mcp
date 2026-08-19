import type { ActionRequest } from "../../../../src/types/action.js";
import { MAX_INPUT_CHORD_KEYS, MAX_INPUT_SHORTCUT_CHARACTERS, MAX_INPUT_TEXT_CHARACTERS } from "../../../../src/protocol/limits.js";
import { modifierMask } from "./modifiers";
import { heldModifierMask, isHeldKey, normalizeHeldKey } from "./held-modifiers";
import { abortableDelay, assertInputDuration, inputCount, inputDuration } from "./abortable-delay";
import { acquireKey, dispatchKey, pressKey, releaseKey } from "./key-events";
import { composeImeText } from "./ime-state";
import { executionError } from "../actions/execution-error.js";
const keyboardActions = new Set(["keyDown", "keyUp", "press", "type", "typeSlowly", "holdKey", "releaseKey", "repeatKey", "shortcut", "composeText", "undo", "redo", "copy", "cut", "paste"]);
const press = (tabId: number, value: string, modifiers = 0, signal?: AbortSignal) => pressKey(tabId, value, modifiers | heldModifierMask(tabId), signal);
const boundedText = (value: unknown) => {
  const text = String(value ?? "");
  return text.length <= MAX_INPUT_TEXT_CHARACTERS ? text : (() => { throw new Error(`Input text cannot exceed ${MAX_INPUT_TEXT_CHARACTERS} characters.`); })();
};
const shortcut = async (tabId: number, value: string, additionalModifiers = 0, signal?: AbortSignal) => {
  if (value.length > MAX_INPUT_SHORTCUT_CHARACTERS) throw new Error("The shortcut is too long.");
  const parts = value.split("+").map((part) => part.trim()).filter(Boolean); const key = value === "+" || value.endsWith("++") ? "+" : parts.pop();
  if (!key) throw new Error("A shortcut key is required."); if (parts.length > MAX_INPUT_CHORD_KEYS) throw new Error(`A shortcut cannot hold more than ${MAX_INPUT_CHORD_KEYS} modifier keys.`);
  const names = parts.map(normalizeHeldKey); if (names.some((name) => modifierMask([name]) === 0)) throw executionError("Shortcut prefixes must be modifier keys.", true);
  const acquired: string[] = []; let failure: unknown;
  try {
    for (const name of names) {
      signal?.throwIfAborted();
      if (isHeldKey(tabId, name)) continue;
      acquired.push(name);
      await acquireKey(tabId, name, additionalModifiers | heldModifierMask(tabId) | modifierMask([name]), false, signal);
    }
    await press(tabId, key, additionalModifiers | heldModifierMask(tabId), signal);
  } catch (error) { failure = error; }
  for (const name of acquired.reverse()) {
    try { await releaseKey(tabId, name, (additionalModifiers | heldModifierMask(tabId)) & ~modifierMask([name])); }
    catch (error) { failure ??= error; }
  }
  if (failure) throw failure;
};
const typeText = async (tabId: number, value: string, slowly: boolean, intervalValue: unknown, signal?: AbortSignal) => {
  const interval = slowly ? inputDuration(intervalValue, 55, "intervalMs") : 0; slowly && assertInputDuration(value.length * interval * 1.35, "Typing duration");
  for (const character of value) {
    signal?.throwIfAborted();
    await press(tabId, character, 0, signal);
    if (slowly) await abortableDelay(interval + Math.random() * interval * 0.35, signal);
  }
  return value.length;
};
export const executeKeyboardInput = async (request: ActionRequest, tabId: number, signal?: AbortSignal) => {
  if (!keyboardActions.has(request.action)) return undefined;
  const key = String(request.params?.key ?? request.params?.shortcut ?? "");
  const modifiers = modifierMask(request.params?.modifiers);
  if (request.action === "composeText") {
    const text = boundedText(request.params?.text);
    await composeImeText(tabId, text, request.params?.commit !== false, signal);
    return text.length;
  }
  if (request.action === "type" || request.action === "typeSlowly") return typeText(tabId, boundedText(request.params?.text), request.action === "typeSlowly", request.params?.intervalMs, signal);
  if (request.action === "shortcut" || request.action === "press" && request.params?.shortcut !== undefined) return (await shortcut(tabId, key, modifiers, signal), true);
  if (["undo", "redo", "copy", "cut", "paste"].includes(request.action)) {
    const modifier = (await chrome.runtime.getPlatformInfo()).os === "mac" ? "Meta" : "Control";
    const keyName = request.action === "undo" ? "Z" : request.action === "redo" ? "Shift+Z" : request.action === "copy" ? "C" : request.action === "cut" ? "X" : "V";
    return (await shortcut(tabId, `${modifier}+${keyName}`, 0, signal), true);
  }
  if (!key) throw new Error("A key is required.");
  if (request.action === "keyDown" || request.action === "holdKey") {
    const normalized = normalizeHeldKey(key);
    const mask = modifiers | heldModifierMask(tabId) | modifierMask([normalized]);
    await acquireKey(tabId, normalized, mask, false, signal);
    return true;
  }
  if (request.action === "keyUp" || request.action === "releaseKey") {
    const normalized = normalizeHeldKey(key);
    await releaseKey(tabId, normalized, (modifiers | heldModifierMask(tabId)) & ~modifierMask([normalized]));
    return true;
  }
  const repeats = request.action === "repeatKey" ? inputCount(request.params?.count, 1, "count") : 1;
  if (request.action === "repeatKey" && repeats > 1) {
    const interval = inputDuration(request.params?.intervalMs, 40, "intervalMs");
    assertInputDuration((repeats - 1) * interval, "Key-repeat duration");
    const normalized = normalizeHeldKey(key);
    const mask = modifiers | heldModifierMask(tabId) | modifierMask([normalized]);
    await acquireKey(tabId, normalized, mask, true, signal);
    let failure: unknown;
    try {
      for (let index = 1; index < repeats; index += 1) {
        signal?.throwIfAborted();
        await dispatchKey(tabId, "keyDown", normalized, mask, true);
        await abortableDelay(interval, signal);
      }
    } catch (error) { failure = error; }
    try { await releaseKey(tabId, normalized, (modifiers | heldModifierMask(tabId)) & ~modifierMask([normalized])); }
    catch (error) { failure ??= error; }
    if (failure) throw failure;
  } else await press(tabId, key, modifiers, signal);
  return true;
};
