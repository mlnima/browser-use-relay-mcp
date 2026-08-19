import type { ActionLocator } from "../../../../src/types/action.js";
import { collectElements, getComposedParent } from "./element-tree.js";
import { resolveLocatorAll } from "./resolve-locator.js";

export type ElementRelationship =
  | "parent"
  | "ancestor"
  | "child"
  | "descendant"
  | "nextSibling"
  | "previousSibling"
  | "sibling";

export type RelationshipQuery = {
  relationship: ElementRelationship;
  locator?: ActionLocator;
  nth?: number;
};

const getAncestors = (element: Element): Element[] => {
  const ancestors: Element[] = [];
  let current = getComposedParent(element);
  while (current) {
    ancestors.push(current);
    current = getComposedParent(current);
  }
  return ancestors;
};

const getChildren = (element: Element): Element[] => [
  ...Array.from(element.children),
  ...Array.from(element.shadowRoot?.children || []),
];

const getSiblings = (element: Element): Element[] => {
  const parent = element.parentElement;
  if (parent) return Array.from(parent.children).filter((candidate) => candidate !== element);
  const root = element.getRootNode();
  return root instanceof ShadowRoot
    ? Array.from(root.children).filter((candidate) => candidate !== element)
    : [];
};

const getRelated = (element: Element, relationship: ElementRelationship): Element[] => {
  if (relationship === "parent") return getComposedParent(element) ? [getComposedParent(element)!] : [];
  if (relationship === "ancestor") return getAncestors(element);
  if (relationship === "child") return getChildren(element);
  if (relationship === "descendant") return collectElements(element);
  if (relationship === "nextSibling") return element.nextElementSibling ? [element.nextElementSibling] : [];
  if (relationship === "previousSibling") return element.previousElementSibling ? [element.previousElementSibling] : [];
  return getSiblings(element);
};

export const resolveRelatedElement = (element: Element, query: RelationshipQuery): Element | undefined => {
  const locator = query.locator && { ...query.locator, nth: undefined };
  const located = locator ? new Set(resolveLocatorAll(locator)) : undefined;
  const matches = getRelated(element, query.relationship).filter((candidate) => !located || located.has(candidate));
  const index = query.nth === undefined ? 0 : query.nth < 0 ? matches.length + query.nth : query.nth;
  return matches[index];
};
