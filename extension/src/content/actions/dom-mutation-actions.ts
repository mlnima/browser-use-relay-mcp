import type { ActionTarget } from "../../../../src/types/action.js";
import type { JsonValue } from "../../../../src/types/json.js";
import { resolveTarget } from "../catalog/resolve-target.js";
import { registerElement } from "../catalog/registry.js";
import type { ContentActionHandler } from "./types.js";
import { requireElement } from "./element.js";
import {
  assertIdentifierFreeMarkup, assertIdentifierFreeTree, assertNonIdentifierName,
  assertReplaceableChildren, assertSafeStructuralMethod, objectValue,
} from "./dom-mutation-guard.js";
import {
  createDetachedElement, keepDetached, mutationResult, mutationSource, releaseDetached,
} from "./dom-mutation-build.js";
type InsertPosition = "beforebegin" | "afterbegin" | "beforeend" | "afterend";
const positions = new Set<InsertPosition>(["beforebegin", "afterbegin", "beforeend", "afterend"]);
const destination = (value: JsonValue | undefined) => requireElement(resolveTarget(
 objectValue(value, "destination") as unknown as ActionTarget,
));
const insert = (parent: Element, element: Element, rawPosition?: JsonValue) => {
  const position = String(rawPosition ?? "beforeend") as InsertPosition;
  if (!positions.has(position)) throw new Error("Position must be beforebegin, afterbegin, beforeend, or afterend.");
  if (!element.isConnected) assertIdentifierFreeTree(element);
  if (!parent.insertAdjacentElement(position, element)) throw new Error("The destination cannot accept that insertion position.");
  releaseDetached(element);
  return mutationResult(element);
};

const setText = (element: Element, value: string) => {
  assertReplaceableChildren(element);
  element.textContent = value;
  return value;
};
const setHtml = (element: Element, value: string) => {
  assertReplaceableChildren(element);
  assertIdentifierFreeMarkup(value);
  element.innerHTML = value;
  return element.innerHTML;
};

const setProperty = (element: Element, name: string, value: JsonValue | undefined) => {
  assertNonIdentifierName(name);
  if (name === "outerHTML" || name === "outerText") throw new Error(`${name} replacement is forbidden because it can remove element identifiers.`);
  if (name === "innerHTML") return setHtml(element, String(value ?? ""));
  if (name === "textContent" || name === "innerText") return setText(element, String(value ?? ""));
  (element as unknown as Record<string, JsonValue | undefined>)[name] = value;
  return mutationResult((element as unknown as Record<string, unknown>)[name]);
};

const setStyle = (element: Element, params?: Record<string, JsonValue>) => {
  if (!(element instanceof HTMLElement || element instanceof SVGElement)) throw new Error("The target has no mutable style.");
  const styles: Record<string, JsonValue> = params?.styles === undefined ? {} : objectValue(params.styles, "styles");
  if (typeof params?.name === "string") styles[params.name] = params.value ?? "";
  for (const [name, value] of Object.entries(styles)) element.style.setProperty(name, String(value ?? ""), params?.priority === "important" ? "important" : "");
  return Object.fromEntries(Object.keys(styles).map((name) => [name, element.style.getPropertyValue(name)]));
};

export const domMutationActionHandlers: Record<string, ContentActionHandler> = {
  setText: async ({ target, request }) => setText(requireElement(target), String(request.params?.text ?? "")),
  setHTML: async ({ target, request }) => setHtml(requireElement(target), String(request.params?.html ?? "")),
  setAttribute: async ({ target, request }) => {
    const name = String(request.params?.name ?? "");
    assertNonIdentifierName(name);
    requireElement(target).setAttribute(name, String(request.params?.value ?? ""));
    return true;
  },
  removeAttribute: async ({ target, request }) => {
    const name = String(request.params?.name ?? "");
    assertNonIdentifierName(name);
    requireElement(target).removeAttribute(name);
    return true;
  },
  setProperty: async ({ target, request }) => setProperty(requireElement(target), String(request.params?.name ?? ""), request.params?.value),
  setStyle: async ({ target, request }) => setStyle(requireElement(target), request.params),
  createElement: async ({ request }) => createDetachedElement(request.params).result,
  appendElement: async ({ target, request }) => insert(requireElement(target), mutationSource(request.params?.source), request.params?.position),
  removeElement: async ({ target }) => {
    const element = requireElement(target);
    assertIdentifierFreeTree(element);
    const elementId = registerElement(element);
    element.remove();
    keepDetached(element);
    return { elementId, removed: true };
  },
  moveElement: async ({ target, request }) => insert(destination(request.params?.destination), requireElement(target), request.params?.position),
  cloneElement: async ({ target, request }) => {
    const clone = requireElement(target).cloneNode(request.params?.deep !== false) as Element;
    assertIdentifierFreeTree(clone);
    if (!request.params?.destination) return keepDetached(clone);
    return insert(destination(request.params.destination), clone, request.params?.position);
  },
  callMethod: async ({ target, request }) => {
    const element = requireElement(target) as unknown as Record<string, unknown>;
    const name = String(request.params?.name ?? "");
    const args = Array.isArray(request.params?.args) ? request.params.args : [];
    assertSafeStructuralMethod(element as unknown as Element, name, args);
    const method = element[name];
    if (typeof method !== "function") throw new Error(`Target method "${name}" is unavailable.`);
    return mutationResult(await (method as (...values: JsonValue[]) => unknown).apply(element, args));
  },
};
