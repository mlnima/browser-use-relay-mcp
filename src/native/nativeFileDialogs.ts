import { platform } from "node:os";
import { basename, dirname } from "node:path";
import type { ActionRequest } from "../types/action.js";
import type { JsonValue } from "../types/json.js";
import { MAX_FILE_PATH_CHARACTERS } from "../protocol/limits.js";
import { abortableDelay, createNativeError, throwIfAborted } from "./nativeError.js";
import { assertNativeKeyAvailable, assertNativeTextKeysAvailable, tapNativeKeys } from "./nativeInputState.js";
import { assertNativeInputDuration, assertNativeText, nativeInputDuration, nativeTypingPlan } from "./nativeInputLimits.js";
import { platformModifier, resolveKey } from "./nativeKeys.js";
import { assertNoNativeWebTarget, optionalRequestPoint, requiredStringParam, stringArrayParam } from "./nativeParams.js";
import { executeNativePointerClick } from "./nativePointerClick.js";
import { typeNativeText } from "./nativeKeyboard.js";
const pressEnter = () => tapNativeKeys([resolveKey("Enter")]);
const selectField = () => tapNativeKeys([platformModifier(), resolveKey("A")]);
const waitDialog = (durationMs: number, signal: AbortSignal) => abortableDelay(durationMs, signal);
const pathFieldKeys = () => platform() === "darwin"
  ? [platformModifier(), resolveKey("LeftShift"), resolveKey("G")]
  : platform() === "win32" ? [resolveKey("LeftAlt"), resolveKey("N")] : [resolveKey("LeftControl"), resolveKey("L")];
const focusPathField = async (durationMs: number, signal: AbortSignal) => {
  await tapNativeKeys(pathFieldKeys());
  await waitDialog(durationMs, signal);
  await selectField();
};
const dismissOnCancellation = async (error: unknown, signal: AbortSignal) => {
  if (signal.aborted) await tapNativeKeys([resolveKey("Escape")]).catch(() => undefined);
  throw error;
};
export const chooseNativeFiles = async (request: ActionRequest, signal: AbortSignal): Promise<JsonValue> => {
  assertNoNativeWebTarget(request);
  const point = optionalRequestPoint(request);
  const paths = stringArrayParam(request, "files") || stringArrayParam(request, "paths") ||
    [requiredStringParam(request, "path")];
  if (!paths.length) throw createNativeError("INVALID_NATIVE_PARAMETERS", "At least one file path is required.");
  if (platform() === "darwin" && paths.length > 1)
    throw createNativeError("NATIVE_MULTI_FILE_UNAVAILABLE", "The macOS chooser requires one path per native action.");
  const dialogDelayMs = nativeInputDuration(request.params?.dialogDelayMs, 250, "Dialog delayMs");
  const delayMs = nativeInputDuration(request.params?.delayMs, 10, "Typing intervalMs");
  const value = paths.length > 1 ? paths.map((path) => `"${path}"`).join(" ") : paths[0] || "";
  const typingMs = nativeTypingPlan(value, delayMs, MAX_FILE_PATH_CHARACTERS).durationMs;
  [pathFieldKeys().at(-1), resolveKey("A"), resolveKey("Enter")].forEach(assertNativeKeyAvailable);
  assertNativeTextKeysAvailable(value);
  const opens = request.action === "setInputFiles" && Boolean(point);
  const pointerMs = opens && request.params?.durationMs !== undefined && request.params.durationMs !== null
    ? nativeInputDuration(request.params.durationMs, 0, "Pointer durationMs") : 0;
  assertNativeInputDuration(pointerMs + typingMs + dialogDelayMs * (1 + Number(opens) + Number(platform() === "darwin")), "Native file chooser duration");
  try {
    if (request.action === "setInputFiles" && point) {
      await executeNativePointerClick({ ...request, action: "leftClick" }, signal);
      await waitDialog(dialogDelayMs, signal);
    }
    await focusPathField(dialogDelayMs, signal);
    await typeNativeText(value, delayMs, signal, MAX_FILE_PATH_CHARACTERS);
    throwIfAborted(signal);
    await pressEnter();
    if (platform() === "darwin") {
      await waitDialog(dialogDelayMs, signal);
      throwIfAborted(signal);
      await pressEnter();
    }
    return { paths };
  } catch (error) {
    return dismissOnCancellation(error, signal);
  }
};
export const saveNativeFile = async (request: ActionRequest, signal: AbortSignal): Promise<JsonValue> => {
  assertNoNativeWebTarget(request);
  optionalRequestPoint(request);
  const path = requiredStringParam(request, "path");
  const dialogDelayMs = nativeInputDuration(request.params?.dialogDelayMs, 250, "Dialog delayMs");
  const delayMs = nativeInputDuration(request.params?.delayMs, 10, "Typing intervalMs");
  assertNativeText(path, MAX_FILE_PATH_CHARACTERS);
  const splitPath = platform() === "darwin" && dirname(path) !== ".";
  const texts = splitPath ? [dirname(path), basename(path)] : [platform() === "darwin" ? basename(path) : path];
  const typingMs = texts.reduce((sum, text) => sum + nativeTypingPlan(text, delayMs, MAX_FILE_PATH_CHARACTERS).durationMs, 0);
  const usesFocus = platform() !== "darwin" || splitPath;
  [usesFocus ? pathFieldKeys().at(-1) : undefined, resolveKey("A"), resolveKey("Enter")].forEach(assertNativeKeyAvailable);
  texts.forEach(assertNativeTextKeysAvailable);
  assertNativeInputDuration(typingMs + dialogDelayMs * (Number(usesFocus) + Number(splitPath)), "Native save-dialog duration");
  try {
    if (splitPath) {
      await focusPathField(dialogDelayMs, signal);
      await typeNativeText(dirname(path), delayMs, signal, MAX_FILE_PATH_CHARACTERS);
      throwIfAborted(signal);
      await pressEnter();
      await waitDialog(dialogDelayMs, signal);
      await selectField();
    } else if (platform() !== "darwin") await focusPathField(dialogDelayMs, signal);
    else await selectField();
    await typeNativeText(platform() === "darwin" ? basename(path) : path, delayMs, signal, MAX_FILE_PATH_CHARACTERS);
    throwIfAborted(signal);
    await pressEnter();
    return { path };
  } catch (error) {
    return dismissOnCancellation(error, signal);
  }
};
