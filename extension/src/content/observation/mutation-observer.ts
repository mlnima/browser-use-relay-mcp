import { trackRootElements } from "./element-observers.js";
import { markRevision } from "./revision.js";

type Scan = { walkers: TreeWalker[]; root?: Element; rootPending: boolean };
const scanBatch = 500;
const addedScanLimit = 64;
const reconcileIntervalMs = 30_000;
let observer: MutationObserver | undefined;
let observedRoots = new WeakSet<Node>();
let addedScans: Scan[] = [];
let reconciliation: Scan | undefined;
let reconciliationRequested = true;
let lastReconciledAt = -Infinity;

const scanFor = (root: Document | ShadowRoot | Element): Scan => ({
  walkers: [document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)],
  root: root instanceof Element ? root : undefined,
  rootPending: root instanceof Element,
});
const observeRoot = (root: Document | ShadowRoot): void => {
  if (observedRoots.has(root)) return;
  observedRoots.add(root);
  observer?.observe(root, { subtree: true, childList: true, attributes: true, characterData: true });
};
const nextElement = (scan: Scan): Element | undefined => {
  if (scan.root && !scan.root.isConnected) return undefined;
  if (scan.rootPending) {
    scan.rootPending = false;
    return scan.root;
  }
  while (scan.walkers.length) {
    const element = scan.walkers.at(-1)!.nextNode();
    if (element instanceof Element) return element;
    scan.walkers.pop();
  }
  return undefined;
};
const scanElement = (scan: Scan) => {
  const element = nextElement(scan);
  if (!element) return false;
  if (element.shadowRoot) {
    observeRoot(element.shadowRoot);
    scan.walkers.push(document.createTreeWalker(element.shadowRoot, NodeFilter.SHOW_ELEMENT));
  }
  return true;
};
const processAdded = (maximum: number) => {
  let processed = 0;
  while (processed < maximum && addedScans.length) {
    if (scanElement(addedScans[0])) processed += 1;
    else addedScans.shift();
  }
  return processed;
};
const queueAddedNodes = (records: MutationRecord[]): void => {
  for (const record of records) for (const node of record.addedNodes) {
    if (!(node instanceof Element)) continue;
    if (addedScans.length < addedScanLimit) addedScans.push(scanFor(node));
    else reconciliationRequested = true;
  }
};
export const refreshMutationObservation = (): void => {
  trackRootElements([document.documentElement, document.body].filter((element): element is HTMLElement => Boolean(element)));
  if (!reconciliation && (reconciliationRequested || performance.now() - lastReconciledAt >= reconcileIntervalMs)) {
    reconciliation = scanFor(document);
    reconciliationRequested = false;
  }
  const addedProcessed = processAdded(Math.floor(scanBatch / 2));
  let remaining = scanBatch - addedProcessed;
  while (reconciliation && remaining > 0) {
    if (scanElement(reconciliation)) remaining -= 1;
    else {
      reconciliation = undefined;
      lastReconciledAt = performance.now();
    }
  }
  remaining > 0 && processAdded(remaining);
};
export const startMutationObservation = (): void => {
  observer = new MutationObserver((records) => {
    markRevision("mutation");
    queueAddedNodes(records);
  });
  observeRoot(document);
  reconciliationRequested = true;
  refreshMutationObservation();
};
export const stopMutationObservation = (): void => {
  observer?.disconnect();
  observer = undefined;
  observedRoots = new WeakSet<Node>();
  addedScans = [];
  reconciliation = undefined;
  reconciliationRequested = true;
  lastReconciledAt = -Infinity;
};
