import { markRevision } from "./revision.js";

let resizeObserver: ResizeObserver | undefined;
let intersectionObserver: IntersectionObserver | undefined;
let observedElements = new Set<Element>();
let rootElements = new Set<Element>();
let actionElements = new Set<Element>();
let snapshotElements = new Set<Element>();
let observedSizes = new WeakMap<Element, string>();
let observedIntersections = new WeakMap<Element, string>();
const observedLimit = 2_500;

const unobserve = (element: Element): void => {
  resizeObserver?.unobserve(element);
  intersectionObserver?.unobserve(element);
  observedElements.delete(element);
  rootElements.delete(element);
  actionElements.delete(element);
  snapshotElements.delete(element);
  observedSizes.delete(element);
  observedIntersections.delete(element);
};

const pruneObserved = (): void => {
  for (const element of observedElements) !element.isConnected && unobserve(element);
};

const trimObserved = (): void => {
  const candidates = observedElements.values();
  while (observedElements.size - rootElements.size > observedLimit) {
    let candidate = candidates.next();
    while (!candidate.done && rootElements.has(candidate.value)) candidate = candidates.next();
    if (candidate.done) return;
    unobserve(candidate.value);
  }
};

export const startElementObservers = (): void => {
  resizeObserver = new ResizeObserver((entries) => {
    let changed = false;
    entries.forEach((entry) => {
      const signature = `${entry.contentRect.width.toFixed(2)}:${entry.contentRect.height.toFixed(2)}`;
      const previous = observedSizes.get(entry.target);
      observedSizes.set(entry.target, signature);
      previous !== undefined && previous !== signature && (changed = true);
    });
    changed && markRevision("resize");
  });
  intersectionObserver = new IntersectionObserver((entries) => {
    let changed = false;
    entries.forEach((entry) => {
      const signature = `${entry.isIntersecting}:${entry.intersectionRatio.toFixed(4)}`;
      const previous = observedIntersections.get(entry.target);
      observedIntersections.set(entry.target, signature);
      previous !== undefined && previous !== signature && (changed = true);
    });
    changed && markRevision("intersection");
  }, {
    threshold: [0, 0.01, 0.25, 0.5, 0.75, 1],
  });
  trackRootElements([document.documentElement, document.body].filter((element): element is HTMLElement => Boolean(element)));
};

const observeElements = (elements: Iterable<Element>): void => {
  if (!resizeObserver || !intersectionObserver) return;
  pruneObserved();
  for (const element of elements) {
    if (!element.isConnected) continue;
    if (observedElements.has(element)) {
      if (!rootElements.has(element)) {
        observedElements.delete(element);
        observedElements.add(element);
      }
      continue;
    }
    observedElements.add(element);
    resizeObserver.observe(element);
    intersectionObserver.observe(element);
  }
  trimObserved();
};

export const trackObservedElements = (elements: Iterable<Element>): void => {
  const selected = Array.from(elements);
  selected.forEach((element) => actionElements.add(element));
  observeElements(selected);
};

export const trackSnapshotElements = (elements: Iterable<Element>): void => {
  if (!resizeObserver || !intersectionObserver) return;
  const next = new Set(Array.from(elements).filter((element) => element.isConnected));
  snapshotElements.forEach((element) =>
    !next.has(element) && !rootElements.has(element) && !actionElements.has(element) && unobserve(element));
  snapshotElements = next;
  observeElements(next);
};

export const trackRootElements = (elements: Iterable<Element>): void => {
  const roots = Array.from(elements).filter((element) => element.isConnected);
  roots.forEach((element) => rootElements.add(element));
  observeElements(roots);
};

export const stopElementObservers = (): void => {
  resizeObserver?.disconnect();
  intersectionObserver?.disconnect();
  resizeObserver = undefined;
  intersectionObserver = undefined;
  observedElements = new Set<Element>();
  rootElements = new Set<Element>();
  actionElements = new Set<Element>();
  snapshotElements = new Set<Element>();
  observedSizes = new WeakMap<Element, string>();
  observedIntersections = new WeakMap<Element, string>();
};
