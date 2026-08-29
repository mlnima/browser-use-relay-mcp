import { jsonStringPartsBytesWithin, MAX_CONTENT_VALUE_BYTES } from "../../../../src/protocol/limits.js";
import { isElementEnabled, isElementReadonly } from "../catalog/element-state.js";
import { dispatchValueEvents, requireHtmlElement } from "./element.js";

export type TextControl = HTMLInputElement | HTMLTextAreaElement;
export type TextOffsets = { start: number; end: number };
const textInputTypes = new Set(["text", "search", "url", "tel", "email", "password"]);

export const isTextControl = (element: Element): element is TextControl =>
  element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement && textInputTypes.has(element.type);

export const requireEditableTarget = (target?: Element, writable = false): HTMLElement => {
  const element = requireHtmlElement(target);
  if (!isTextControl(element) && !element.isContentEditable) throw new Error("The target is not editable.");
  if (writable && (!isElementEnabled(element) || isElementReadonly(element))) throw new Error("The editable target is disabled or readonly.");
  return element;
};
export const requireContentEditableTarget = (target?: Element, writable = false) => {
  const element = requireEditableTarget(target, writable);
  if (!element.isContentEditable) throw new Error("The target is not contenteditable.");
  return element;
};

const clampOffset = (value: number, length: number): number =>
  Math.max(0, Math.min(length, Number.isFinite(value) ? Math.floor(value) : 0));

export const getControlSelection = (element: TextControl): TextOffsets => ({
  start: element.selectionStart ?? element.value.length,
  end: element.selectionEnd ?? element.value.length,
});

export const setControlSelection = (element: TextControl, start: number, end: number): TextOffsets => {
  const next = {
    start: clampOffset(Math.min(start, end), element.value.length),
    end: clampOffset(Math.max(start, end), element.value.length),
  };
  element.selectionStart !== null && element.setSelectionRange(next.start, next.end);
  return next;
};

const setControlValue = (element: TextControl, value: string): void => {
  const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (!setter) throw new Error("The editable control has no value setter.");
  setter.call(element, value);
};

export const replaceControlText = (
  element: TextControl,
  value: string,
  start: number,
  end: number,
  inputType: string,
): string => {
  const range = { start: clampOffset(Math.min(start, end), element.value.length), end: clampOffset(Math.max(start, end), element.value.length) };
  if (jsonStringPartsBytesWithin([element.value.slice(0, range.start), value, element.value.slice(range.end)], MAX_CONTENT_VALUE_BYTES) === undefined) throw Object.assign(new Error("The requested editable value exceeds the encoded scalar limit."), { contentCode: "CONTENT_RESULT_TOO_LARGE" });
  const expected = `${element.value.slice(0, range.start)}${value}${element.value.slice(range.end)}`;
  element.focus({ preventScroll: true }); setControlSelection(element, range.start, range.end);
  const data = inputType.startsWith("delete") ? null : value;
  const allowed = element.dispatchEvent(new InputEvent("beforeinput", {
    bubbles: true, cancelable: true, composed: true, data, inputType,
  }));
  if (!allowed) throw new Error("The text edit was cancelled by beforeinput.");
  setControlValue(element, expected);
  if (element.value !== expected) throw new Error("The editable control rejected the requested text.");
  const caret = range.start + value.length;
  setControlSelection(element, caret, caret);
  dispatchValueEvents(element, inputType);
  const observed = getControlSelection(element);
  if (element.value !== expected || observed.start !== caret || observed.end !== caret) throw new Error("The editable control did not retain the requested text and caret state.");
  return expected;
};
