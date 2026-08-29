import type { ElementBounds } from "../../../../src/types/snapshot.js";
import { getComposedParent } from "./element-tree.js";

const nonEditableInputTypes = new Set([
  "button", "checkbox", "color", "file", "hidden", "image", "radio", "range", "reset", "submit",
]);

const hasHiddenAncestor = (element: Element): boolean => {
  let current: Element | undefined = element;
  while (current) {
    const style = getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return true;
    if (Number(style.opacity) === 0 || style.contentVisibility === "hidden") return true;
    if (current.getAttribute("aria-hidden") === "true") return true;
    current = getComposedParent(current);
  }
  return false;
};

const hasDisabledAncestor = (element: Element): boolean => {
  let current: Element | undefined = element;
  while (current) {
    if (current.getAttribute("aria-disabled") === "true" || current.hasAttribute("inert")) return true;
    current = getComposedParent(current);
  }
  return false;
};

export const getElementBounds = (element: Element): ElementBounds => {
  const bounds = element.getBoundingClientRect();
  return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
};

export const isElementVisible = (element: Element): boolean =>
  element.isConnected && element.getClientRects().length > 0 && !hasHiddenAncestor(element);

export const isElementEnabled = (element: Element): boolean =>
  !element.matches(":disabled") && !hasDisabledAncestor(element);

export const isElementReadonly = (element: Element): boolean =>
  element.getAttribute("aria-readonly") === "true"
  || (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) && element.readOnly;

export const isElementEditable = (
  element: Element,
  enabled = isElementEnabled(element),
  readonly = isElementReadonly(element),
): boolean => {
  if (!enabled || readonly) return false;
  if (document.designMode === "on") return true;
  if (element instanceof HTMLElement && element.isContentEditable) return true;
  if (element instanceof HTMLTextAreaElement) return !element.readOnly;
  if (element instanceof HTMLSelectElement) return true;
  return element instanceof HTMLInputElement && !element.readOnly && !nonEditableInputTypes.has(element.type);
};
