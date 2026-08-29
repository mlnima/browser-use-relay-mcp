import type { ActionLocator } from "../../../../src/types/action.js";
import { collectElements, collectOpenRoots, querySelectorAllOpen } from "./element-tree.js";
import { matchesLocator } from "./locator-match.js";

const appendXPathMatches = (
  xpath: string,
  context: Node,
  matches: Element[],
  expectedRoot?: Document | ShadowRoot,
): void => {
  try {
    const result = document.evaluate(xpath, context, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE);
    for (let index = 0; index < result.snapshotLength; index += 1) {
      const node = result.snapshotItem(index);
      node instanceof Element && (!expectedRoot || node.getRootNode() === expectedRoot) && matches.push(node);
    }
  } catch {}
};

const evaluateShadowXPath = (xpath: string, root: ShadowRoot, matches: Element[]): void => {
  const startLength = matches.length;
  appendXPathMatches(xpath, root, matches, root);
  if (matches.length > startLength) return;
  const descendantPath = xpath.startsWith(".//") ? xpath.slice(3) : xpath.startsWith("//") ? xpath.slice(2) : undefined;
  for (const child of root.children) {
    appendXPathMatches(descendantPath ? `.//${descendantPath}` : xpath, child, matches, root);
    descendantPath && appendXPathMatches(`self::${descendantPath}`, child, matches, root);
  }
};

const evaluateXPath = (xpath: string): Element[] => {
  const matches: Element[] = [];
  for (const root of collectOpenRoots()) {
    root instanceof Document
      ? appendXPathMatches(xpath, root, matches)
      : evaluateShadowXPath(xpath, root, matches);
  }
  return Array.from(new Set(matches));
};

const selectorCandidates = (selector: string | undefined): Element[] => {
  if (!selector) return collectElements();
  try {
    return querySelectorAllOpen(selector);
  } catch (error) {
    throw new Error(`Invalid standard CSS selector: ${error instanceof Error ? error.message : selector}`);
  }
};

const applyNth = (elements: Element[], nth: number | undefined): Element[] => {
  if (nth === undefined) return elements;
  const index = nth < 0 ? elements.length + nth : nth;
  return elements[index] ? [elements[index]] : [];
};

export const resolveLocatorAll = (locator: ActionLocator): Element[] => {
  const candidates = selectorCandidates(locator.selector);
  const xpathMatches = locator.xpath ? new Set(evaluateXPath(locator.xpath)) : undefined;
  const matched = candidates.filter((element) =>
    (!xpathMatches || xpathMatches.has(element)) && matchesLocator(element, locator));
  return applyNth(Array.from(new Set(matched)), locator.nth);
};

export const resolveLocator = (locator: ActionLocator): Element | undefined => resolveLocatorAll(locator)[0];
