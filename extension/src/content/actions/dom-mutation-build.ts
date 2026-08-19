import type { ActionTarget } from "../../../../src/types/action.js";
import type { JsonValue } from "../../../../src/types/json.js";
import { describeElement } from "./element-data.js";
import { requireElement, toJsonValue } from "./element.js";
import { resolveTarget } from "../catalog/resolve-target.js";
import { forgetDetachedElement, getElementId, registerElement } from "../catalog/registry.js";
import { assertIdentifierFreeMarkup, assertNonIdentifierName, objectValue } from "./dom-mutation-guard.js";

const detached = new Map<string, Element>();
const detachedLimit = 512;

export const keepDetached = (element: Element) => {
  const elementId = registerElement(element);
  detached.delete(elementId);
  detached.set(elementId, element);
  if (detached.size > detachedLimit) {
    const expired = detached.keys().next().value as string;
    detached.delete(expired);
    forgetDetachedElement(expired);
  }
  return { elementId, tag: element.localName, detached: true };
};

export const releaseDetached = (element: Element): void => {
  const elementId = getElementId(element);
  elementId && detached.delete(elementId);
};

export const mutationSource = (value: JsonValue | undefined): Element => {
  const source = typeof value === "string" ? { elementId: value } : objectValue(value, "source");
  const elementId = typeof source.elementId === "string" ? source.elementId : undefined;
  const stored = elementId ? detached.get(elementId) : undefined;
  return stored || requireElement(resolveTarget(source as unknown as ActionTarget));
};

export const applyAttributes = (element: Element, value: JsonValue | undefined): void => {
  if (value === undefined) return;
  for (const [name, attribute] of Object.entries(objectValue(value, "attributes"))) {
    assertNonIdentifierName(name);
    element.setAttribute(name, String(attribute ?? ""));
  }
};

export const applyProperties = (element: Element, value: JsonValue | undefined): void => {
  if (value === undefined) return;
  const target = element as unknown as Record<string, JsonValue>;
  for (const [name, property] of Object.entries(objectValue(value, "properties"))) {
    assertNonIdentifierName(name);
    if (["innerHTML", "outerHTML", "textContent", "innerText", "outerText"].includes(name)) {
      throw new Error(`Structural property "${name}" requires its dedicated action.`);
    }
    target[name] = property;
  }
};

export const createDetachedElement = (params?: Record<string, JsonValue>) => {
  const tagName = String(params?.tagName ?? "");
  if (!tagName) throw new Error("createElement requires params.tagName.");
  const namespace = typeof params?.namespace === "string" ? params.namespace : undefined;
  const element = namespace ? document.createElementNS(namespace, tagName) : document.createElement(tagName);
  applyAttributes(element, params?.attributes);
  applyProperties(element, params?.properties);
  if (typeof params?.html === "string") {
    assertIdentifierFreeMarkup(params.html);
    element.innerHTML = params.html;
  } else if (params?.text !== undefined) element.textContent = String(params.text);
  return { element, result: keepDetached(element) };
};

export const mutationResult = (value: unknown): JsonValue => value instanceof Element
  ? describeElement(value)
  : toJsonValue(value, undefined, "Mutation result");
