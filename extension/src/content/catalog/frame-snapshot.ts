import { DEFAULT_SNAPSHOT_ELEMENTS, MAX_SNAPSHOT_ELEMENTS, MAX_SNAPSHOT_SCANNED_ELEMENTS } from "../../../../src/protocol/limits.js";
import type { CatalogElement, FrameSnapshot, SnapshotCatalogMetadata } from "../../../../src/types/snapshot.js";
import { createSnapshotStringLimiter, snapshotCatalogByteLimit, snapshotEncodedBytes } from "../../shared/snapshot-limit.js";
import { trackSnapshotElements } from "../observation/element-observers.js";
import { getRevision } from "../observation/revision.js";
import { createCatalogElement, isCatalogElementMeaningful, isPotentialCatalogElement } from "./catalog-element.js";
import { isElementVisible } from "./element-state.js";
import { pruneRegistry } from "./registry.js";

export type FrameSnapshotOptions = { includeHidden?: boolean; maxElements?: number; maxCatalogBytes?: number; maxScannedElements?: number };

const snapshotLimit = (value?: number) => typeof value === "number" && Number.isFinite(value)
  ? Math.max(0, Math.min(MAX_SNAPSHOT_ELEMENTS, Math.floor(value))) : DEFAULT_SNAPSHOT_ELEMENTS;

const scannedLimit = (value?: number) => typeof value === "number" && Number.isFinite(value)
  ? Math.max(0, Math.min(MAX_SNAPSHOT_SCANNED_ELEMENTS, Math.floor(value))) : MAX_SNAPSHOT_SCANNED_ELEMENTS;

const intersectsViewport = (element: Element) => {
  const bounds = element.getBoundingClientRect();
  return bounds.bottom >= 0 && bounds.right >= 0 && bounds.top <= innerHeight && bounds.left <= innerWidth;
};

const scanCandidates = (options: FrameSnapshotOptions, scanLimit: number, outputLimit: number) => {
  const walkers = [document.createTreeWalker(document, NodeFilter.SHOW_ELEMENT)];
  const semantic: Element[] = [];
  const evaluationLimit = Math.min(scanLimit, Math.max(600, outputLimit * 4));
  let scannedElementCount = 0;
  let scanTruncated = false;
  while (walkers.length) {
    const element = walkers[walkers.length - 1].nextNode() as Element | null;
    if (!element) { walkers.pop(); continue; }
    if (scannedElementCount >= scanLimit) { scanTruncated = true; break; }
    scannedElementCount += 1;
    element.shadowRoot && walkers.push(document.createTreeWalker(element.shadowRoot, NodeFilter.SHOW_ELEMENT));
    isPotentialCatalogElement(element) && semantic.push(element);
  }
  const scrollRange = Math.max(0, document.documentElement.scrollHeight - innerHeight);
  const scrollRatio = scrollRange > 0 ? Math.max(0, Math.min(1, scrollY / scrollRange)) : 0;
  const leadingCount = scrollRatio > 0.1 ? Math.floor(evaluationLimit * 0.2) : 0;
  const focusCount = evaluationLimit - leadingCount;
  const focusStart = Math.floor(Math.max(0, semantic.length - focusCount) * scrollRatio);
  const selected = semantic.length <= evaluationLimit ? semantic : Array.from(new Set([
    ...semantic.slice(0, leadingCount),
    ...semantic.slice(focusStart, focusStart + focusCount),
  ])).slice(0, evaluationLimit);
  const viewport: Array<{ element: Element; visible: boolean }> = [];
  const outside: Array<{ element: Element; visible: boolean }> = [];
  for (const element of selected) {
    const visible = isElementVisible(element);
    if (!options.includeHidden && !visible) continue;
    (visible && intersectsViewport(element) ? viewport : outside).push({ element, visible });
  }
  return { candidates: [...viewport, ...outside], scannedElementCount, scanTruncated: scanTruncated || semantic.length > selected.length };
};

const captureElements = (options: FrameSnapshotOptions) => {
  const limit = snapshotLimit(options.maxElements);
  const scanLimit = scannedLimit(options.maxScannedElements);
  const byteLimit = snapshotCatalogByteLimit(options.maxCatalogBytes);
  const scan = scanCandidates(options, scanLimit, limit);
  const elements: CatalogElement[] = [];
  const observed: Element[] = [];
  let encodedBytes = 0;
  let stringTruncationCount = 0;
  let omittedAttributeCount = 0;
  let omittedSelectedValueCount = 0;
  let omittedElementCount = 0;
  let truncationReason: SnapshotCatalogMetadata["truncationReason"] = scan.scanTruncated ? "maxScannedElements" : undefined;
  for (const { element, visible } of scan.candidates) {
    if (elements.length >= limit) { truncationReason = "maxElements"; break; }
    const output = createCatalogElement(element, visible);
    if (!isCatalogElementMeaningful(output.descriptor)) { omittedElementCount += 1; continue; }
    const additionalBytes = snapshotEncodedBytes(output.descriptor) + Number(elements.length > 0);
    if (encodedBytes + additionalBytes > byteLimit) { truncationReason = "maxBytes"; break; }
    elements.push(output.descriptor);
    observed.push(element);
    encodedBytes += additionalBytes;
    stringTruncationCount += output.truncatedStrings;
    omittedAttributeCount += output.omittedAttributes;
    omittedSelectedValueCount += output.omittedSelectedValues;
  }
  trackSnapshotElements(observed);
  pruneRegistry();
  const catalog: SnapshotCatalogMetadata = {
    byteLimit, encodedBytes, returnedElementCount: elements.length, scannedElementCount: scan.scannedElementCount, scannedElementLimit: scanLimit,
    stringTruncationCount, omittedAttributeCount, omittedSelectedValueCount,
    omittedElementCount,
    truncated: Boolean(truncationReason), ...(truncationReason && { truncationReason }),
  };
  return { elements, catalog };
};

export const createFrameSnapshot = (frameId?: number, documentId?: string, options: FrameSnapshotOptions = {}): FrameSnapshot => {
  let revision = getRevision();
  let captured = captureElements(options);
  let stable = revision === getRevision();
  for (let attempt = 0; !stable && attempt < 2; attempt += 1) {
    revision = getRevision();
    captured = captureElements(options);
    stable = revision === getRevision();
  }
  const limiter = createSnapshotStringLimiter();
  const url = limiter.limit(location.href)!;
  const title = limiter.limit(document.title)!;
  captured.catalog.stringTruncationCount += limiter.stats.truncatedStrings;
  !stable && (captured.catalog.unstable = true);
  return {
    frameId: frameId ?? 0,
    documentId,
    url,
    title,
    revision,
    ...captured,
  };
};
