import type { ActionRequest } from "../../../../src/types/action.js";
import { jsonStringPartsBytesWithin, MAX_CONTENT_JSON_ITEMS, MAX_CONTENT_VALUE_BYTES } from "../../../../src/protocol/limits.js";
import { getDeepActiveElement } from "../catalog/element-tree.js";
import { isElementEnabled } from "../catalog/element-state.js";
import { registerElement } from "../catalog/registry";
import { getContentSelectionState, selectContentAll } from "./content-selection.js";
import { getControlSelection, isTextControl, requireContentEditableTarget, requireEditableTarget, setControlSelection } from "./editable-target.js";
import { requireHtmlElement, toJsonValue } from "./element.js";
import { deleteEditableText, getEditableLength, getEditableSelectedText, getEditableSelection, insertEditableText, replaceEditableAll, selectEditableRange } from "./text-edit.js";
import type { ContentActionHandler } from "./types.js";

const failSelection = (detail: string): never => {
  throw Object.assign(new Error(`getSelection exceeds the ${detail}.`), { contentCode: "CONTENT_RESULT_TOO_LARGE" });
};
const requiredParam = (params: ActionRequest["params"], name: string) => {
  if (!params || !Object.hasOwn(params, name)) throw new Error(`${name} is required.`);
  return String(params[name] ?? "");
};
const selectableTarget = (target?: Element) => {
  const element = requireEditableTarget(target);
  if (!isElementEnabled(element)) throw new Error("The editable target is disabled.");
  return element;
};
const changeFocus = (target: Element | undefined, field: boolean, blur: boolean) => {
  const element = field ? requireHtmlElement(target) : selectableTarget(target);
  const compatible = !field || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement || element instanceof HTMLButtonElement || element instanceof HTMLInputElement && element.type !== "hidden";
  if (!compatible || !isElementEnabled(element)) throw new Error("The target is not an enabled compatible focus target.");
  if (blur && getDeepActiveElement() !== element) throw new Error("The target is not currently focused.");
  blur ? element.blur() : element.focus(); const active = getDeepActiveElement();
  if (blur ? active === element : active !== element) throw new Error(`The target did not ${blur ? "blur" : "focus"}.`);
  return true;
};
const selectedText = (target?: Element) => {
  const element = target ? requireEditableTarget(target) : undefined;
  if (element) {
    const range = getEditableSelection(element);
    if (range.end - range.start > MAX_CONTENT_VALUE_BYTES) failSelection(`${MAX_CONTENT_VALUE_BYTES}-character source limit`);
    return getEditableSelectedText(element);
  }
  const selection = document.getSelection();
  if (!selection?.rangeCount) return "";
  const range = selection.getRangeAt(0), walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_ALL);
  let characters = 0, nodes = 0, node: Node | null = range.commonAncestorContainer instanceof Text ? range.commonAncestorContainer : walker.nextNode();
  while (node) {
    if (++nodes > MAX_CONTENT_JSON_ITEMS) failSelection(`${MAX_CONTENT_JSON_ITEMS}-node source limit`);
    if (node instanceof Text && range.intersectsNode(node)) characters += Math.max(0, (node === range.endContainer ? range.endOffset : node.data.length) - (node === range.startContainer ? range.startOffset : 0));
    if (characters > MAX_CONTENT_VALUE_BYTES) failSelection(`${MAX_CONTENT_VALUE_BYTES}-character source limit`);
    node = walker.nextNode();
  }
  return selection.toString();
};
const selectionState = (target?: Element) => {
  const element = selectableTarget(target), state = isTextControl(element) ? { ...getControlSelection(element), value: element.value } : getContentSelectionState(element);
  if (jsonStringPartsBytesWithin([state.value], MAX_CONTENT_VALUE_BYTES) === undefined) failSelection(`${MAX_CONTENT_VALUE_BYTES}-byte encoded scalar limit`);
  return { identity: registerElement(element), ...state, focused: getDeepActiveElement() === element };
};

export const textActionHandlers: Record<string, ContentActionHandler> = {
  focus: async ({ target }) => changeFocus(target, false, false),
  blur: async ({ target }) => changeFocus(target, false, true),
  clear: async ({ target }) => replaceEditableAll(requireEditableTarget(target, true), ""),
  setValue: async ({ target, request }) => replaceEditableAll(requireEditableTarget(target, true), requiredParam(request.params, "value")),
  appendText: async ({ target, request }) => insertEditableText(requireEditableTarget(target, true), requiredParam(request.params, "text"), true),
  replaceText: async ({ target, request }) => insertEditableText(requireEditableTarget(target, true), requiredParam(request.params, "text"), false, true),
  insertText: async ({ target, request }) => insertEditableText(requireEditableTarget(target, true), requiredParam(request.params, "text")),
  contentEditableInsert: async ({ target, request }) => insertEditableText(requireContentEditableTarget(target, true), requiredParam(request.params, "text")),
  deleteText: async ({ target, request }) => {
    deleteEditableText(requireEditableTarget(target, true), request.params?.direction === "forward" ? "forward" : "backward", Number(request.params?.count ?? 1)); return true;
  },
  contentEditableDelete: async ({ target, request }) => {
    deleteEditableText(requireContentEditableTarget(target, true), request.params?.direction === "forward" ? "forward" : "backward", Number(request.params?.count ?? 1)); return true;
  },
  selectAll: async ({ target }) => {
    const element = selectableTarget(target); isTextControl(element) ? setControlSelection(element, 0, getEditableLength(element)) : selectContentAll(element); return true;
  },
  selectRange: async ({ target, request }) => {
    const element = selectableTarget(target), start = Number(request.params?.start ?? 0), end = Number(request.params?.end ?? start); return selectEditableRange(element, start, end);
  },
  setCaretPosition: async ({ target, request }) => {
    const position = Number(request.params?.position ?? 0); return selectEditableRange(selectableTarget(target), position, position).start;
  },
  getSelection: async ({ target, request }) => request.params?.state === true ? selectionState(target) : toJsonValue(selectedText(target), MAX_CONTENT_VALUE_BYTES, "getSelection result"),
  focusField: async ({ target }) => changeFocus(target, true, false),
  blurField: async ({ target }) => changeFocus(target, true, true),
};
