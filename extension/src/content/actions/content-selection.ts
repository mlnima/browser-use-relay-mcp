import { MAX_CONTENT_JSON_ITEMS, MAX_CONTENT_VALUE_BYTES } from "../../../../src/protocol/limits.js";
import type { TextOffsets } from "./editable-target.js";

type TextIndex = { nodes: Text[]; length: number };
type RangePoint = { node: Node; offset: number };

const fail = (detail: string): never => {
  throw Object.assign(new Error(`Editable content exceeds the ${detail}.`), { contentCode: "CONTENT_RESULT_TOO_LARGE" });
};
const scanText = (element: HTMLElement): TextIndex => {
  const nodes: Text[] = []; const walker = document.createTreeWalker(element, NodeFilter.SHOW_ALL);
  let current = walker.nextNode(), length = 0, scanned = 0;
  while (current) {
    if (++scanned > MAX_CONTENT_JSON_ITEMS) fail(`${MAX_CONTENT_JSON_ITEMS}-node source limit`);
    if (current instanceof Text) { length += current.data.length; if (length > MAX_CONTENT_VALUE_BYTES) fail(`${MAX_CONTENT_VALUE_BYTES}-character source limit`); nodes.push(current); }
    current = walker.nextNode();
  }
  return { nodes, length };
};
const clampOffset = (value: number, length: number) => Math.max(0, Math.min(length, Number.isFinite(value) ? Math.floor(value) : 0));
const pointAt = (element: HTMLElement, index: TextIndex, position: number): RangePoint => {
  let remaining = clampOffset(position, index.length);
  for (const node of index.nodes) {
    if (remaining <= node.data.length) return { node, offset: remaining };
    remaining -= node.data.length;
  }
  return { node: element, offset: element.childNodes.length };
};
const offsetAt = (index: TextIndex, node: Node, offset: number): number => {
  let position = 0; const probe = document.createRange(); probe.setStart(node, offset); probe.collapse(true);
  for (const text of index.nodes) {
    if (text === node) return position + clampOffset(offset, text.data.length);
    if (probe.comparePoint(text, text.data.length) >= 0) return position;
    position += text.data.length;
  }
  return position;
};
const selectionOffsets = (element: HTMLElement, index: TextIndex): TextOffsets => {
  const selection = document.getSelection();
  if (!selection?.rangeCount) return { start: index.length, end: index.length };
  const range = selection.getRangeAt(0);
  if (!element.contains(range.startContainer) || !element.contains(range.endContainer)) return { start: index.length, end: index.length };
  return { start: offsetAt(index, range.startContainer, range.startOffset), end: offsetAt(index, range.endContainer, range.endOffset) };
};
const selectedText = (index: TextIndex, range: TextOffsets) => {
  const chunks: string[] = []; let position = 0;
  for (const node of index.nodes) {
    const from = Math.max(0, range.start - position), to = Math.min(node.data.length, range.end - position);
    if (to > from) chunks.push(node.data.slice(from, to));
    position += node.data.length;
    if (position >= range.end) break;
  }
  return chunks.join("");
};

export const getContentLength = (element: HTMLElement) => scanText(element).length;
export const getContentText = (element: HTMLElement) => { const index = scanText(element); return selectedText(index, { start: 0, end: index.length }); };
export const getContentSelectionState = (element: HTMLElement) => {
  const index = scanText(element), range = selectionOffsets(element, index); return { ...range, value: selectedText(index, { start: 0, end: index.length }) };
};
export const getContentSelection = (element: HTMLElement) => selectionOffsets(element, scanText(element));
export const getContentSelectedText = (element: HTMLElement) => {
  const index = scanText(element); return selectedText(index, selectionOffsets(element, index));
};
export const selectContentAll = (element: HTMLElement): TextOffsets => {
  const index = scanText(element); element.focus(); const range = document.createRange(); range.selectNodeContents(element);
  const selection = document.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
  return { start: 0, end: index.length };
};
export const setContentSelection = (element: HTMLElement, start: number, end: number): TextOffsets => {
  const index = scanText(element); const next = { start: clampOffset(Math.min(start, end), index.length), end: clampOffset(Math.max(start, end), index.length) };
  const from = pointAt(element, index, next.start), to = pointAt(element, index, next.end); const range = document.createRange();
  range.setStart(from.node, from.offset); range.setEnd(to.node, to.offset);
  const selection = document.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
  return next;
};
