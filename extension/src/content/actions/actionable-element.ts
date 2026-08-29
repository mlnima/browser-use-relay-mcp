import { isElementVisible } from "../catalog/element-state.js";
import { elementFromPointOpen, getComposedParent } from "../catalog/element-tree.js";
import { requireElement } from "./element.js";
import { trackObservedElements } from "../observation/element-observers.js";
import { createFingerprint } from "../catalog/fingerprint.js";

type ActionableBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  hitX: number;
  hitY: number;
  path: ElementPathStep[];
};
type ResolveTarget = () => Element | undefined;
type StableHit = { element: Element; bounds: DOMRect; hit?: { x: number; y: number } };

export type ElementPathStep = {
  scope: "document" | "children" | "shadow";
  index: number;
};

const nextPaint = (signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  let settled = false;
  let frame = 0;
  let timer = 0;
  const finish = (callback: () => void) => {
    if (settled) return;
    settled = true;
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
    callback();
  };
  const abort = () => finish(() => reject(signal.reason instanceof Error ? signal.reason : new Error("Action cancelled.")));
  if (signal.aborted) {
    abort();
    return;
  }
  signal.addEventListener("abort", abort, { once: true });
  frame = requestAnimationFrame(() => finish(resolve));
  timer = window.setTimeout(() => finish(resolve), 50);
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
const identityFor = (element: Element) => {
  const { tag, role, name, text, attributes } = createFingerprint(element);
  return JSON.stringify({ tag, role, name, text, attributes });
};

const stableHitAfterScroll = async (initial: Element, identity: string, resolveTarget: ResolveTarget, signal: AbortSignal): Promise<StableHit> => {
  let element = initial;
  let previous = "";
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await nextPaint(signal);
    const replacement = element.isConnected ? element : resolveTarget();
    if (!replacement) throw new Error("The target element became stale while scrolling into view.");
    if (identityFor(replacement) !== identity) throw new Error("The target element became stale while scrolling into view.");
    if (replacement !== element) {
      element = replacement;
      element.scrollIntoView({ behavior: "instant", block: "nearest", inline: "nearest" });
      previous = "";
    }
    const bounds = element.getBoundingClientRect();
    const hit = findHit(element, bounds);
    const key = [bounds.x, bounds.y, bounds.width, bounds.height, hit?.x, hit?.y]
      .map((value) => Math.round(Number(value) * 100) / 100).join(":");
    const latest = { element, bounds, hit };
    if (key === previous) return latest;
    previous = key;
  }
  throw new Error("The target element timed out before its position stabilized.");
};

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

const resolveActionable = async (target: Element | undefined, resolveTarget: ResolveTarget, signal: AbortSignal): Promise<StableHit> => {
  let element = requireElement(target);
  if (!isElementVisible(element)) throw new Error("The target element is hidden or has no rendered box.");
  const identity = identityFor(element);
  element.scrollIntoView({ behavior: "instant", block: "nearest", inline: "nearest" });
  let settled = await stableHitAfterScroll(element, identity, resolveTarget, signal);
  if (!settled.hit) {
    settled.element.scrollIntoView({ behavior: "instant", block: "center", inline: "center" });
    settled = await stableHitAfterScroll(settled.element, identity, resolveTarget, signal);
  }
  if (!isElementVisible(settled.element)) throw new Error("The target element is hidden or has no rendered box.");
  if (settled.bounds.width <= 0 || settled.bounds.height <= 0) throw new Error("The target element has a zero-size rendered box.");
  if (!settled.hit) throw new Error("The target element is outside the viewport or covered at every tested point.");
  trackObservedElements([settled.element]);
  return settled;
};

export const getActionableBounds = async (target: Element | undefined, resolveTarget: ResolveTarget, signal: AbortSignal): Promise<ActionableBounds> => {
  const { element, bounds, hit } = await resolveActionable(target, resolveTarget, signal);
  if (!hit) {
    throw new Error("The target element is outside the viewport or covered at every tested point.");
  }
  return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, hitX: hit.x, hitY: hit.y, path: getElementPath(element) };
};

export const requireActionableElement = async (target: Element | undefined, resolveTarget: ResolveTarget, signal: AbortSignal): Promise<Element> =>
  (await resolveActionable(target, resolveTarget, signal)).element;
