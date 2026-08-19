import { markRevision } from "./revision.js";

let resizeObserver: ResizeObserver | undefined;
let intersectionObserver: IntersectionObserver | undefined;
let observedElements = new Set<Element>();
let rootElements = new Set<Element>();
const observedLimit = 20_000;

const unobserve = (element: Element): void => {
  resizeObserver?.unobserve(element);
  intersectionObserver?.unobserve(element);
  observedElements.delete(element);
  rootElements.delete(element);
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
  resizeObserver = new ResizeObserver(() => markRevision("resize"));
  intersectionObserver = new IntersectionObserver(() => markRevision("intersection"), {
    threshold: [0, 0.01, 0.25, 0.5, 0.75, 1],
  });
  trackRootElements([document.documentElement, document.body].filter((element): element is HTMLElement => Boolean(element)));
};

export const trackObservedElements = (elements: Iterable<Element>): void => {
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

export const trackRootElements = (elements: Iterable<Element>): void => {
  const roots = Array.from(elements).filter((element) => element.isConnected);
  roots.forEach((element) => rootElements.add(element));
  trackObservedElements(roots);
};

export const stopElementObservers = (): void => {
  resizeObserver?.disconnect();
  intersectionObserver?.disconnect();
  resizeObserver = undefined;
  intersectionObserver = undefined;
  observedElements = new Set<Element>();
  rootElements = new Set<Element>();
};
