import { jsonStringPartsBytesWithin, MAX_CONTENT_VALUE_BYTES } from "../../../../src/protocol/limits.js";
import { dispatchValueEvents } from "./element.js";
import { getContentLength, getContentSelectedText, getContentSelection, getContentText, setContentSelection } from "./content-selection.js";
import { getControlSelection, isTextControl, replaceControlText, setControlSelection, type TextOffsets } from "./editable-target.js";

export const getEditableLength = (element: HTMLElement) => isTextControl(element) ? element.value.length : getContentLength(element);
export const getEditableSelection = (element: HTMLElement): TextOffsets => isTextControl(element) ? getControlSelection(element) : getContentSelection(element);
export const selectEditableRange = (element: HTMLElement, start: number, end: number): TextOffsets => {
  element.focus(); return isTextControl(element) ? setControlSelection(element, start, end) : setContentSelection(element, start, end);
};
const failSize = (): never => {
  throw Object.assign(new Error(`Editable content exceeds the ${MAX_CONTENT_VALUE_BYTES}-byte encoded scalar limit.`), { contentCode: "CONTENT_RESULT_TOO_LARGE" });
};
const normalizedRange = (start: number, end: number, length: number) => {
  const clamp = (value: number) => Math.max(0, Math.min(length, Number.isFinite(value) ? Math.floor(value) : 0));
  return { start: clamp(Math.min(start, end)), end: clamp(Math.max(start, end)) };
};
const replaceContentText = (element: HTMLElement, value: string, start: number, end: number, inputType: string, whole = false) => {
  const before = getContentText(element), offsets = whole ? { start: 0, end: before.length } : normalizedRange(start, end, before.length);
  if (jsonStringPartsBytesWithin([before.slice(0, offsets.start), value, before.slice(offsets.end)], MAX_CONTENT_VALUE_BYTES) === undefined) failSize();
  const expected = `${before.slice(0, offsets.start)}${value}${before.slice(offsets.end)}`;
  element.focus(); const range = document.createRange();
  if (whole) range.selectNodeContents(element);
  else {
    setContentSelection(element, offsets.start, offsets.end); const current = document.getSelection()?.getRangeAt(0);
    if (!current) throw new Error("The editable selection is unavailable.");
    range.setStart(current.startContainer, current.startOffset); range.setEnd(current.endContainer, current.endOffset);
  }
  const data = inputType.startsWith("delete") ? null : value;
  const allowed = element.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, cancelable: true, composed: true, data, inputType }));
  if (!allowed) throw new Error("The text edit was cancelled by beforeinput.");
  range.deleteContents(); const node = value ? document.createTextNode(value) : undefined; node && range.insertNode(node);
  node ? range.setStartAfter(node) : range.collapse(true); range.collapse(true);
  const selection = document.getSelection(); selection?.removeAllRanges(); selection?.addRange(range); dispatchValueEvents(element, inputType);
  const observed = getContentText(element), caret = getContentSelection(element), expectedCaret = offsets.start + value.length;
  if (observed !== expected || caret.start !== expectedCaret || caret.end !== expectedCaret) throw new Error("The contenteditable target did not retain the requested text and caret state.");
  return observed;
};
export const replaceEditableRange = (element: HTMLElement, value: string, start: number, end: number, inputType: string) => isTextControl(element)
  ? replaceControlText(element, value, start, end, inputType)
  : replaceContentText(element, value, start, end, inputType);
export const replaceEditableAll = (element: HTMLElement, value: string) => {
  const inputType = value ? "insertReplacementText" : "deleteContentBackward";
  return isTextControl(element) ? replaceControlText(element, value, 0, element.value.length, inputType) : replaceContentText(element, value, 0, 0, inputType, true);
};
export const insertEditableText = (element: HTMLElement, value: string, append = false, replacement = false) => {
  const length = append ? getEditableLength(element) : 0, range = append ? { start: length, end: length } : getEditableSelection(element);
  return replaceEditableRange(element, value, range.start, range.end, replacement ? "insertReplacementText" : "insertText");
};
export const deleteEditableText = (element: HTMLElement, direction: string, count: number) => {
  const range = getEditableSelection(element), size = Math.max(1, Math.floor(Number.isFinite(count) ? count : 1));
  const start = range.start === range.end && direction !== "forward" ? Math.max(0, range.start - size) : range.start;
  const end = range.start === range.end && direction === "forward" ? Math.min(getEditableLength(element), range.end + size) : range.end;
  return replaceEditableRange(element, "", start, end, direction === "forward" ? "deleteContentForward" : "deleteContentBackward");
};
export const getEditableSelectedText = (element: HTMLElement) => {
  if (!isTextControl(element)) return getContentSelectedText(element);
  const range = getEditableSelection(element); return element.value.slice(range.start, range.end);
};
