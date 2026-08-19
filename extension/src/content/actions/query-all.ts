import { MAX_CONTENT_QUERY_OFFSET, MAX_CONTENT_QUERY_RESULTS, MAX_CONTENT_VALUE_BYTES } from "../../../../src/protocol/limits.js";
import type { JsonValue } from "../../../../src/types/json.js";
import { describeElement } from "./element-data";
import { toJsonValueWithBytes } from "./element.js";

export const queryInteger = (value: unknown, fallback: number, minimum: number, maximum: number, label: string) => {
  const resolved = value === undefined ? fallback : value;
  if (typeof resolved !== "number" || !Number.isSafeInteger(resolved) || resolved < minimum || resolved > maximum) {
    throw new Error(`${label} must be an integer from ${minimum} to ${maximum}.`);
  }
  return resolved;
};

export const visitElements = (selector: string, visit: (element: Element) => boolean | void) => {
  document.createDocumentFragment().querySelector(selector);
  const walkers = [document.createTreeWalker(document, NodeFilter.SHOW_ELEMENT)];
  while (walkers.length) {
    const element = walkers[walkers.length - 1].nextNode() as Element | null;
    if (!element) { walkers.pop(); continue; }
    if (element.matches(selector) && visit(element) === false) return false;
    element.shadowRoot && walkers.push(document.createTreeWalker(element.shadowRoot, NodeFilter.SHOW_ELEMENT));
  }
  return true;
};

export const queryAll = (selector: string, rawLimit?: unknown, rawOffset?: unknown): JsonValue => {
  const limit = queryInteger(rawLimit, MAX_CONTENT_QUERY_RESULTS, 1, MAX_CONTENT_QUERY_RESULTS, "limit");
  const offset = queryInteger(rawOffset, 0, 0, MAX_CONTENT_QUERY_OFFSET, "offset");
  const elements: JsonValue[] = [];
  let matched = 0;
  let encodedBytes = 2;
  let truncationReason: "limit" | "byteLimit" | undefined;
  visitElements(selector, (element) => {
    matched += 1;
    if (matched <= offset) return;
    if (elements.length >= limit) {
      truncationReason = "limit";
      return false;
    }
    const output = toJsonValueWithBytes(describeElement(element), MAX_CONTENT_VALUE_BYTES, "Element descriptor");
    const requiredBytes = output.encodedBytes + Number(elements.length > 0);
    if (encodedBytes + requiredBytes > MAX_CONTENT_VALUE_BYTES) {
      truncationReason = "byteLimit";
      return false;
    }
    elements.push(output.value);
    encodedBytes += requiredBytes;
  });
  const truncated = Boolean(truncationReason);
  return {
    elements, offset, limit, returnedElementCount: elements.length,
    totalMatched: truncated ? null : matched, truncated,
    nextOffset: truncated ? offset + elements.length : null,
    encodedBytes, byteLimit: MAX_CONTENT_VALUE_BYTES,
    ...(truncationReason && { truncationReason }),
  };
};
