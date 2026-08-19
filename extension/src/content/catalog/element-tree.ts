export type ElementRoot = Document | DocumentFragment | Element;

const appendRootElements = (root: ElementRoot, output: Element[]): void => {
  for (const element of root.querySelectorAll("*")) {
    output.push(element);
    element.shadowRoot && appendRootElements(element.shadowRoot, output);
    element instanceof HTMLTemplateElement && appendRootElements(element.content, output);
  }
};

export const collectElements = (root: ElementRoot = document): Element[] => {
  const elements: Element[] = [];
  root instanceof Element && root.shadowRoot && appendRootElements(root.shadowRoot, elements);
  root instanceof HTMLTemplateElement && appendRootElements(root.content, elements);
  appendRootElements(root, elements);
  return elements;
};

export const collectElementsBounded = (limit: number) => {
  const elements: Element[] = [];
  const walkers = [document.createTreeWalker(document, NodeFilter.SHOW_ELEMENT)];
  while (walkers.length) {
    const element = walkers[walkers.length - 1].nextNode() as Element | null;
    if (!element) { walkers.pop(); continue; }
    if (elements.length >= limit) return { elements, truncated: true };
    elements.push(element);
    element.shadowRoot && walkers.push(document.createTreeWalker(element.shadowRoot, NodeFilter.SHOW_ELEMENT));
  }
  return { elements, truncated: false };
};

export const collectOpenRoots = (root: ElementRoot = document): (Document | ShadowRoot)[] => {
  const roots: (Document | ShadowRoot)[] = root instanceof Document || root instanceof ShadowRoot
    ? [root] : root instanceof Element && root.shadowRoot ? [root.shadowRoot] : [];
  for (const element of collectElements(root)) element.shadowRoot && roots.push(element.shadowRoot);
  return roots;
};

const queryPierced = (selector: string): Element[] => {
  const parts = selector.split(">>>").map((part) => part.trim());
  let roots: ElementRoot[] = [document];
  let matches: Element[] = [];
  for (const part of parts) {
    matches = roots.flatMap((root) => Array.from(root.querySelectorAll(part)));
    roots = matches.flatMap((element) => element.shadowRoot ? [element.shadowRoot] : []);
  }
  return matches;
};

export const querySelectorAllOpen = (selector: string): Element[] => selector.includes(">>>")
  ? queryPierced(selector)
  : collectOpenRoots().flatMap((root) => Array.from(root.querySelectorAll(selector)));

export const elementFromPointOpen = (x: number, y: number): Element | undefined => {
  let current = document.elementFromPoint(x, y) || undefined;
  let nested = current?.shadowRoot?.elementFromPoint(x, y) || undefined;
  while (nested && nested !== current) {
    current = nested;
    nested = current.shadowRoot?.elementFromPoint(x, y) || undefined;
  }
  return current;
};

export const getComposedParent = (element: Element): Element | undefined => {
  if (element.assignedSlot) return element.assignedSlot;
  if (element.parentElement) return element.parentElement;
  const root = element.getRootNode();
  return root instanceof ShadowRoot ? root.host : undefined;
};

export const getDeepActiveElement = (): Element | undefined => {
  let active = document.activeElement || undefined;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
};
