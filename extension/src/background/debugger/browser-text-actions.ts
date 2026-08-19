import type { ActionRequest } from "../../../../src/types/action.js"; import { jsonStringPartsBytesWithin, MAX_CONTENT_VALUE_BYTES, MAX_INPUT_TEXT_CHARACTERS } from "../../../../src/protocol/limits.js";
import { executeContentAction } from "../actions/content-transport"; import { executionError } from "../actions/execution-error";
import { assertInputDuration, inputCount, inputDuration } from "./abortable-delay.js"; import { executeKeyboardInput } from "./keyboard-input"; import { executeMouseInput } from "./mouse-input";
const textActions = new Set(["focus", "blur", "clear", "setValue", "appendText", "replaceText", "insertText", "deleteText", "selectAll", "selectRange", "contentEditableInsert", "contentEditableDelete", "undo", "redo", "focusField", "blurField"]); const clickActions = new Set(["check", "uncheck", "toggleCheckbox", "selectRadio"]);
const mutationActions = new Set(["clear", "setValue", "appendText", "replaceText", "insertText", "deleteText", "contentEditableInsert", "contentEditableDelete"]); const selectionActions = new Set(["selectAll", "selectRange"]);
const textInputTypes = new Set(["text", "search", "url", "tel", "email", "password"]);
type ElementState = Record<string, unknown>; type SelectionState = { identity: string; start: number; end: number; text: string; value: string; focused: boolean }; type EditExpectation = { value: string; caret: number };
const platformModifier = async () => (await chrome.runtime.getPlatformInfo()).os === "mac" ? "Meta" : "Control"; const keyRequest = (request: ActionRequest, action: string, params: ActionRequest["params"]): ActionRequest => ({ ...request, action, params });
const readState = async (request: ActionRequest, signal: AbortSignal | undefined, fallbackSafe: boolean) => {
  const result = await executeContentAction({ ...request, action: "getElementState", engine: "dom" }, signal); const state = result.success && result.data && typeof result.data === "object" && !Array.isArray(result.data) ? result.data as ElementState : undefined;
  if (!state) throw executionError(result.error?.message || "Unable to inspect the target control.", fallbackSafe && result.error?.code === "TARGET_RESOLUTION_FAILED"); return state;
};
const readSelection = async (request: ActionRequest, signal: AbortSignal | undefined, fallbackSafe: boolean) => {
  const result = await executeContentAction({ ...request, action: "getSelection", engine: "dom", params: { ...request.params, state: true } }, signal); const data = result.data;
  const state = result.success && data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : undefined;
  if (!state || typeof state.identity !== "string" || typeof state.start !== "number" || typeof state.end !== "number" || typeof state.value !== "string" || typeof state.focused !== "boolean") throw executionError(result.error?.message || "Unable to inspect the target selection.", fallbackSafe && result.error?.code === "TARGET_RESOLUTION_FAILED"); const value = state.value as string, start = state.start as number, end = state.end as number;
  return { identity: state.identity as string, start, end, value, focused: state.focused as boolean, text: value.slice(start, end) };
};
const requireControl = (state: ElementState, valid: boolean, message: string) => {
  if (!valid) throw executionError(message); if (state.enabled !== true) throw executionError("The target control is disabled.");
};
const requiredText = (request: ActionRequest) => {
  const name = request.action === "setValue" ? "value" : ["appendText", "replaceText", "insertText", "contentEditableInsert"].includes(request.action) ? "text" : undefined;
  if (name && (!request.params || !Object.hasOwn(request.params, name))) throw executionError(`${name} is required.`); return name ? String(request.params?.[name] ?? "") : "";
};
const focusTarget = async (request: ActionRequest, action: string, signal?: AbortSignal) => {
  const result = await executeContentAction({ ...request, action, engine: "dom" }, signal); if (!result.success) throw executionError(result.error?.message || `Unable to ${action} the target without activating it.`, result.error?.code === "TARGET_RESOLUTION_FAILED");
};
const sameSelection = (left: SelectionState, right: SelectionState) => left.identity === right.identity && left.start === right.start && left.end === right.end && left.text === right.text && left.value === right.value; const expectedEdit = (request: ActionRequest, before: SelectionState, text: string): EditExpectation => {
  let start = before.start, end = before.end, inserted = text; if (["clear", "setValue"].includes(request.action)) { start = 0; end = before.value.length; inserted = request.action === "clear" ? "" : text; }
  if (request.action === "appendText") start = end = before.value.length;
  if (["deleteText", "contentEditableDelete"].includes(request.action)) { inserted = ""; const count = Number(request.params?.count ?? 1); if (start === end) request.params?.direction === "forward" ? end = Math.min(before.value.length, end + count) : start = Math.max(0, start - count); }
  if (jsonStringPartsBytesWithin([before.value.slice(0, start), inserted, before.value.slice(end)], MAX_CONTENT_VALUE_BYTES) === undefined) throw executionError("The requested text result exceeds the encoded scalar limit."); return { value: `${before.value.slice(0, start)}${inserted}${before.value.slice(end)}`, caret: start + inserted.length };
};
const verifyEdit = async (request: ActionRequest, before: SelectionState, expected: EditExpectation, result: unknown, signal?: AbortSignal) => {
  const observed = await readSelection(request, signal, false);
  if (observed.identity !== before.identity || observed.value !== expected.value || observed.start !== expected.caret || observed.end !== expected.caret) throw executionError("The target did not retain the requested text and caret state."); return result;
};
export const executeBrowserTextAction = async (request: ActionRequest, tabId: number, signal?: AbortSignal) => {
  if (clickActions.has(request.action)) {
    const state = await readState(request, signal, true), expectedType = request.action === "selectRadio" ? "radio" : "checkbox";
    requireControl(state, state.tag === "input" && state.inputType === expectedType && typeof state.checked === "boolean", `The target must be an enabled ${expectedType} input.`);
    const checked = state.checked as boolean, desired = request.action === "check" || request.action === "selectRadio" ? true : request.action === "uncheck" ? false : !checked;
    if (checked !== desired) await executeMouseInput({ ...request, action: "leftClick" }, tabId, signal);
    const observed = checked === desired ? state : await readState(request, signal, false);
    if (observed.checked !== desired) throw new Error(`The ${expectedType} did not reach the requested checked state.`);
    return observed.checked as boolean;
  }
  if (["increment", "decrement"].includes(request.action)) {
    const state = await readState(request, signal, true), count = inputCount(request.params?.steps, 1, "steps");
    requireControl(state, state.tag === "input" && state.inputType === "number" && state.readonly !== true, "The target must be an enabled writable number input.");
    await executeMouseInput({ ...request, action: "leftClick" }, tabId, signal); const key = request.action === "increment" ? "ArrowUp" : "ArrowDown";
    await executeKeyboardInput(keyRequest(request, "repeatKey", { key, count }), tabId, signal); return (await readState(request, signal, false)).value ?? null;
  }
  if (request.action === "submitForm") {
    const state = await readState(request, signal, true), submitter = state.tag === "button" && state.inputType === "submit" || state.tag === "input" && ["submit", "image"].includes(String(state.inputType));
    requireControl(state, submitter && state.formAssociated === true, "The target must be an enabled submit control associated with a form.");
    await executeMouseInput({ ...request, action: "leftClick" }, tabId, signal); return true;
  }
  if (!textActions.has(request.action)) return undefined; if (["undo", "redo"].includes(request.action) && !["elementId", "locator", "x", "y"].some((name) => request.target && Object.hasOwn(request.target, name))) return undefined;
  const directFocus = ["focus", "blur", "focusField", "blurField"].includes(request.action), history = ["undo", "redo"].includes(request.action);
  if (mutationActions.has(request.action) || selectionActions.has(request.action) || directFocus || history) {
    const state = await readState(request, signal, true), tag = String(state.tag || ""), inputType = String(state.inputType || "");
    const compatible = tag === "textarea" || tag === "input" && textInputTypes.has(inputType) || state.contentEditable === true;
    const field = tag === "textarea" || tag === "select" || tag === "button" || tag === "input" && inputType !== "hidden";
    const valid = request.action.endsWith("Field") ? field : compatible && (!(mutationActions.has(request.action) || history) || state.editable === true);
    requireControl(state, valid && (!request.action.startsWith("contentEditable") || state.contentEditable === true), "The target is not a compatible editable control.");
  }
  const rangeStart = request.action === "selectRange" ? inputCount(request.params?.start, 0, "start", 0) : 0;
  const range = request.action === "selectRange" ? { start: rangeStart, end: inputCount(request.params?.end, rangeStart, "end", 0) } : undefined;
  if (range && range.end < range.start) throw new Error("end must be greater than or equal to start.");
  const inputText = requiredText(request);
  if (inputText.length > MAX_INPUT_TEXT_CHARACTERS) throw new Error(`Input text cannot exceed ${MAX_INPUT_TEXT_CHARACTERS} characters.`);
  if (inputText && request.params?.slowly) assertInputDuration(inputText.length * inputDuration(request.params?.intervalMs, 55, "intervalMs") * 1.35, "Typing duration");
  if (["deleteText", "contentEditableDelete"].includes(request.action)) inputCount(request.params?.count, 1, "count");
  if (directFocus) { await focusTarget(request, request.action, signal); return true; }
  const before = mutationActions.has(request.action) || selectionActions.has(request.action) || history ? await readSelection(request, signal, true) : undefined, expected = mutationActions.has(request.action) && before ? expectedEdit(request, before, inputText) : undefined;
  if (request.action === "replaceText" && (!before || before.start === before.end || !before.text)) throw executionError("replaceText requires a non-empty current target selection.");
  if (mutationActions.has(request.action) || selectionActions.has(request.action) || history) await focusTarget(request, "focus", signal);
  if (before) { const prepared = await readSelection(request, signal, false); if (!prepared.focused || !sameSelection(before, prepared)) throw executionError("The exact target selection or focus changed while preparing the text action."); }
  const modifier = await platformModifier();
  if (request.action === "selectRange") {
    const { start, end } = range!; await executeKeyboardInput(keyRequest(request, "shortcut", { shortcut: `${modifier}+Home` }), tabId, signal);
    if (start > 0) await executeKeyboardInput(keyRequest(request, "repeatKey", { key: "ArrowRight", count: start }), tabId, signal);
    if (end > start) await executeKeyboardInput(keyRequest(request, "repeatKey", { key: "ArrowRight", count: end - start, modifiers: ["Shift"] }), tabId, signal); const observed = await readSelection(request, signal, false); if (observed.identity !== before!.identity || !observed.focused || observed.start !== start || observed.end !== end) throw executionError("selectRange did not reach the requested target-relative range."); return { start: observed.start, end: observed.end };
  }
  if (request.action === "selectAll") { await executeKeyboardInput(keyRequest(request, "shortcut", { shortcut: `${modifier}+A` }), tabId, signal); const observed = await readSelection(request, signal, false); if (observed.identity !== before!.identity || !observed.focused || observed.start !== 0 || observed.end !== observed.value.length) throw executionError("selectAll did not select the full exact target value."); return { start: observed.start, end: observed.end }; }
  if (request.action === "undo") return executeKeyboardInput(keyRequest(request, "shortcut", { shortcut: `${modifier}+Z` }), tabId, signal);
  if (request.action === "redo") return executeKeyboardInput(keyRequest(request, "shortcut", { shortcut: `${modifier}+Shift+Z` }), tabId, signal);
  if (["clear", "setValue"].includes(request.action)) {
    await executeKeyboardInput(keyRequest(request, "shortcut", { shortcut: `${modifier}+A` }), tabId, signal); await executeKeyboardInput(keyRequest(request, "press", { key: "Backspace" }), tabId, signal);
  }
  if (request.action === "appendText") await executeKeyboardInput(keyRequest(request, "shortcut", { shortcut: `${modifier}+End` }), tabId, signal);
  if (["deleteText", "contentEditableDelete"].includes(request.action) || request.action === "replaceText" && !inputText) {
    const key = request.params?.direction === "forward" ? "Delete" : "Backspace", count = request.action === "replaceText" || before && before.start !== before.end ? 1 : request.params?.count ?? 1;
    const result = await executeKeyboardInput(keyRequest(request, "repeatKey", { key, count }), tabId, signal); return verifyEdit(request, before!, expected!, result, signal);
  }
  const result = inputText ? await executeKeyboardInput(keyRequest(request, request.params?.slowly ? "typeSlowly" : "type", { text: inputText, intervalMs: request.params?.intervalMs ?? 55 }), tabId, signal) : true;
  return before ? verifyEdit(request, before, expected!, result, signal) : result;
};
