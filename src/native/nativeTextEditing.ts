import type { ActionRequest } from "../types/action.js";
import type { JsonValue } from "../types/json.js";
import { createNativeError } from "./nativeError.js";
import { acquireNativeKeys, assertNativeKeyAvailable, assertNativeTextKeysAvailable, releaseNativeKeys, tapNativeKeys } from "./nativeInputState.js";
import { assertNativeInputDuration, nativeInputCount, nativeInputDuration, nativeTypingPlan, yieldNativeInput } from "./nativeInputLimits.js";
import { platformModifier, resolveKey } from "./nativeKeys.js";
import { assertNoNativeWebTarget, optionalRequestPoint, stringParam, textParam } from "./nativeParams.js";
import { executeNativePointerClick } from "./nativePointerClick.js";
import { typeNativeText } from "./nativeKeyboard.js";

const shortcut = (...keys: ReturnType<typeof resolveKey>[]) => tapNativeKeys(keys);
const selectAll = () => shortcut(platformModifier(), resolveKey("A"));
const focusTargetActions = new Set([
  "blur", "clear", "setValue", "appendText", "insertText", "deleteText",
  "contentEditableInsert", "contentEditableDelete", "selectAll", "selectRange", "undo", "redo",
]);
const clearValue = async () => {
  await selectAll();
  await tapNativeKeys([resolveKey("Backspace")]);
};

const selectRange = async (start: number, end: number, signal: AbortSignal) => {
  const right = resolveKey("Right");
  assertNativeKeyAvailable(right);
  await shortcut(platformModifier(), resolveKey("Home"));
  for (let index = 0; index < start; index += 1) {
    await yieldNativeInput(index, signal);
    await tapNativeKeys([right]);
  }
  const owned = await acquireNativeKeys([resolveKey("LeftShift")]);
  try {
    for (let index = start; index < end; index += 1) {
      await yieldNativeInput(index, signal);
      await tapNativeKeys([right]);
    }
  } finally {
    if (owned.length) await releaseNativeKeys(owned);
  }
  return { start, end };
};

const deleteText = async (count: number, key: ReturnType<typeof resolveKey>, signal: AbortSignal) => {
  for (let index = 0; index < count; index += 1) {
    await yieldNativeInput(index, signal);
    await tapNativeKeys([key]);
  }
  return { count };
};

export const executeNativeTextEditing = async (
  request: ActionRequest,
  signal: AbortSignal,
): Promise<JsonValue | undefined> => {
  const writesText = ["setValue", "appendText", "replaceText", "insertText", "contentEditableInsert"].includes(request.action);
  const value = writesText ? textParam(request, request.action === "setValue" ? "value" : "text") : "";
  const delayMs = writesText ? nativeInputDuration(request.params?.delayMs ?? request.params?.intervalMs, 20, "Typing intervalMs") : 0;
  const typingMs = writesText ? nativeTypingPlan(value, delayMs).durationMs : 0;
  if (writesText) assertNativeTextKeysAvailable(value);
  const selection = request.action === "selectRange" ? {
    start: nativeInputCount(request.params?.start, 0, "Native selection start", 0),
    end: nativeInputCount(request.params?.end, Number.NaN, "Native selection end", 0),
  } : undefined;
  if (selection && selection.end < selection.start)
    throw createNativeError("INVALID_NATIVE_PARAMETERS", "Selection range is invalid.");
  const direction = stringParam(request, "direction") || "Backspace";
  const deletionKey = resolveKey(request.params?.forward === true || /^(delete|forward)$/i.test(direction) ? "Delete" : "Backspace");
  const deleteCount = ["deleteText", "contentEditableDelete"].includes(request.action)
    ? nativeInputCount(request.params?.count, 1, "Native delete count", 0) : 0;
  const triggerNames = ["clear", "setValue"].includes(request.action) ? ["A", "Backspace"]
    : request.action === "appendText" ? ["End"] : request.action === "selectRange" ? ["Home", "Right"]
      : ["deleteText", "contentEditableDelete"].includes(request.action) ? [] : ["blur", "selectAll"].includes(request.action) ? [request.action === "blur" ? "Tab" : "A"]
        : ["undo", "redo"].includes(request.action) ? ["Z"] : [];
  triggerNames.map(resolveKey).forEach(assertNativeKeyAvailable);
  if (["deleteText", "contentEditableDelete"].includes(request.action)) assertNativeKeyAvailable(deletionKey);
  assertNoNativeWebTarget(request);
  const targetPoint = optionalRequestPoint(request);
  const pointerMs = targetPoint && request.params?.durationMs !== undefined && request.params.durationMs !== null
    ? nativeInputDuration(request.params.durationMs, 0, "Pointer durationMs") : 0;
  assertNativeInputDuration(pointerMs + typingMs, "Native text action duration");
  if (request.action === "replaceText" && targetPoint)
    throw createNativeError("NATIVE_SELECTION_REQUIRED", "Native replaceText uses the current OS selection and cannot focus a target.");
  if (focusTargetActions.has(request.action) && targetPoint)
    await executeNativePointerClick({ ...request, action: "leftClick" }, signal);
  switch (request.action) {
    case "focus":
      if (!targetPoint) throw createNativeError("NATIVE_COORDINATES_REQUIRED", "Focus requires screen coordinates.");
      return executeNativePointerClick(request, signal);
    case "blur": await tapNativeKeys([resolveKey("Tab")]); return { blurred: true };
    case "clear": await clearValue(); return { cleared: true };
    case "setValue": await clearValue(); break;
    case "appendText": await shortcut(platformModifier(), resolveKey("End")); break;
    case "deleteText": case "contentEditableDelete": return deleteText(deleteCount, deletionKey, signal);
    case "selectAll": await selectAll(); return { selected: true };
    case "selectRange": return selectRange(selection!.start, selection!.end, signal);
    case "undo": await shortcut(platformModifier(), resolveKey("Z")); return { applied: true };
    case "redo": await shortcut(platformModifier(), resolveKey("LeftShift"), resolveKey("Z")); return { applied: true };
  }
  return { characters: await typeNativeText(value, delayMs, signal) };
};
