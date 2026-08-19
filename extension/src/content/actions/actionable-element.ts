import { isElementVisible } from "../catalog/element-state.js";
import { elementFromPointOpen, getComposedParent } from "../catalog/element-tree.js";
import { requireElement } from "./element.js";
import { trackObservedElements } from "../observation/element-observers.js";

type ActionableBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  hitX: number;
  hitY: number;
  path: ElementPathStep[];
};

export type ElementPathStep = {
  scope: "document" | "children" | "shadow";
  index: number;
};

const nextPaint = () => new Promise<void>((resolve) => {
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    resolve();
  };
  requestAnimationFrame(finish);
  window.setTimeout(finish, 50);
});

const containsComposed = (element: Element, candidate?: Element): boolean => {
  let current = candidate;
  while (current) {
    if (current === element) return true;
    current = getComposedParent(current);
  }
  return false;
};

const pointsFor = (bounds: DOMRect): { x: number; y: number }[] => {
  const left = Math.max(0, bounds.left);
  const top = Math.max(0, bounds.top);
  const right = Math.min(innerWidth, bounds.right);
  const bottom = Math.min(innerHeight, bounds.bottom);
  if (right <= left || bottom <= top) return [];
  const xs = [(left + right) / 2, left + 1, right - 1];
  const ys = [(top + bottom) / 2, top + 1, bottom - 1];
  return xs.flatMap((x) => ys.map((y) => ({ x, y })));
};

const findHit = (element: Element, bounds: DOMRect) => pointsFor(bounds)
  .find((point) => containsComposed(element, elementFromPointOpen(point.x, point.y)));

export const getElementPath = (element: Element): ElementPathStep[] => {
  const path: ElementPathStep[] = [];
  let current = element;
  while (current) {
    if (current.parentElement) {
      path.unshift({ scope: "children", index: Array.from(current.parentElement.children).indexOf(current) });
      current = current.parentElement;
      continue;
    }
    const root = current.getRootNode();
    if (root instanceof ShadowRoot) {
      path.unshift({ scope: "shadow", index: Array.from(root.children).indexOf(current) });
      current = root.host;
      continue;
    }
    path.unshift({ scope: "document", index: Array.from(document.children).indexOf(current) });
    break;
  }
  return path;
};

export const getActionableBounds = async (target?: Element): Promise<ActionableBounds> => {
  const element = requireElement(target);
  if (!isElementVisible(element)) throw new Error("The target element is hidden or has no rendered box.");
  let bounds = element.getBoundingClientRect();
  let hit = findHit(element, bounds);
  if (!hit) {
    element.scrollIntoView({ behavior: "auto", block: "center", inline: "center" });
    await nextPaint();
    bounds = element.getBoundingClientRect();
    hit = findHit(element, bounds);
  }
  if (bounds.width <= 0 || bounds.height <= 0) throw new Error("The target element has a zero-size rendered box.");
  if (!hit) throw new Error("The target element is outside the viewport or covered at every tested point.");
  trackObservedElements([element]);
  return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, hitX: hit.x, hitY: hit.y, path: getElementPath(element) };
};

export const requireActionableElement = async (target?: Element): Promise<Element> => {
  const element = requireElement(target);
  await getActionableBounds(element);
  return element;
};
