import type { ActionRequest } from "../types/action.js";
import type { JsonValue } from "../types/json.js";
import { abortableDelay, createNativeError } from "./nativeError.js";
import { chooseNativeFiles, saveNativeFile } from "./nativeFileDialogs.js";
import { assertNativeKeyAvailable, assertNativeTextKeysAvailable, tapNativeKeys } from "./nativeInputState.js";
import { assertNativeInputDuration, nativeInputCount, nativeInputDuration, nativeTypingPlan, yieldNativeInput } from "./nativeInputLimits.js";
import { assertNativeModifierKeys, platformModifier, resolveKey, resolveKeys, splitShortcut } from "./nativeKeys.js";
import { booleanParam, optionalRequestPoint, requiredStringParam, stringParam } from "./nativeParams.js";
import { executeNativePointerClick } from "./nativePointerClick.js";
import { typeNativeText } from "./nativeKeyboard.js";

const pressEnter = () => tapNativeKeys([resolveKey("Enter")]);
const pressEscape = () => tapNativeKeys([resolveKey("Escape")]);

const controlPrompt = async (request: ActionRequest, signal: AbortSignal) => {
  const decision = requiredStringParam(request, "decision");
  if (!["allow", "deny", "dismiss"].includes(decision))
    throw createNativeError("INVALID_NATIVE_PARAMETERS", "Permission prompt decision must be allow, deny, or dismiss.");
  assertNativeKeyAvailable(resolveKey(decision === "dismiss" ? "Escape" : "Enter"));
  if (decision === "dismiss") {
    await pressEscape();
    return { decision };
  }
  const tabs = nativeInputCount(request.params?.tabCount, decision === "deny" ? 1 : 0, "Native permission prompt tabCount", 0);
  if (tabs > 0) assertNativeKeyAvailable(resolveKey("Tab"));
  for (let index = 0; index < tabs; index += 1) {
    await yieldNativeInput(index, signal);
    await tapNativeKeys([resolveKey("Tab")]);
  }
  await pressEnter();
  return { decision };
};

const controlBrowserUi = async (request: ActionRequest, signal: AbortSignal) => {
  const point = optionalRequestPoint(request);
  const shortcut = stringParam(request, "shortcut");
  const text = stringParam(request, "text");
  const delayMs = text === undefined ? 0 : nativeInputDuration(request.params?.delayMs, 20, "Typing intervalMs");
  const typingMs = text === undefined ? 0 : nativeTypingPlan(text, delayMs).durationMs;
  const shortcutKeys = shortcut ? resolveKeys(splitShortcut(shortcut)) : [];
  assertNativeModifierKeys(shortcutKeys.slice(0, -1));
  assertNativeKeyAvailable(shortcutKeys.at(-1));
  if (text !== undefined) assertNativeTextKeysAvailable(text);
  if (!point && !shortcut && text === undefined)
    throw createNativeError("INVALID_NATIVE_PARAMETERS", "Native browser UI control requires coordinates, shortcut, or text.");
  const pointerMs = point && request.params?.durationMs !== undefined && request.params.durationMs !== null
    ? nativeInputDuration(request.params.durationMs, 0, "Pointer durationMs") : 0;
  assertNativeInputDuration(pointerMs + typingMs, "Native browser UI duration");
  if (point) await executeNativePointerClick(request, signal);
  if (shortcutKeys.length) await tapNativeKeys(shortcutKeys);
  if (text) await typeNativeText(text, delayMs, signal);
  return { applied: true };
};

export const executeNativeDialog = async (
  request: ActionRequest,
  signal: AbortSignal,
): Promise<JsonValue | undefined> => {
  switch (request.action) {
    case "nativeFileChooser": case "setInputFiles":
      return chooseNativeFiles(request, signal);
    case "nativeSaveDialog": return saveNativeFile(request, signal);
    case "nativePrintDialog": {
      const delayMs = nativeInputDuration(request.params?.dialogDelayMs, 500, "Dialog delayMs");
      const finalKey = resolveKey(booleanParam(request, "confirm") === false ? "Escape" : "Enter");
      assertNativeKeyAvailable(finalKey);
      if (booleanParam(request, "open") !== false) assertNativeKeyAvailable(resolveKey("P"));
      if (booleanParam(request, "open") !== false) await tapNativeKeys([platformModifier(), resolveKey("P")]);
      await abortableDelay(delayMs, signal);
      await tapNativeKeys([finalKey]);
      return { confirmed: booleanParam(request, "confirm") !== false };
    }
    case "nativePermissionPrompt": return controlPrompt(request, signal);
    default: return controlBrowserUi(request, signal);
  }
};
