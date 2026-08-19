import { DEFAULT_SNAPSHOT_ELEMENTS, MAX_SNAPSHOT_ELEMENTS, MAX_SNAPSHOT_SCANNED_ELEMENTS } from "../../../../src/protocol/limits.js";
import type { CatalogElement, FrameSnapshot, SnapshotCatalogMetadata } from "../../../../src/types/snapshot.js";
import { createSnapshotStringLimiter, snapshotCatalogByteLimit, snapshotEncodedBytes } from "../../shared/snapshot-limit.js";
import { trackObservedElements } from "../observation/element-observers.js";
import { getRevision } from "../observation/revision.js";
import { createCatalogElement } from "./catalog-element.js";
import { isElementVisible } from "./element-state.js";
import { pruneRegistry } from "./registry.js";

export type FrameSnapshotOptions = { includeHidden?: boolean; maxElements?: number; maxCatalogBytes?: number; maxScannedElements?: number };

const snapshotLimit = (value?: number) => typeof value === "number" && Number.isFinite(value)
  ? Math.max(0, Math.min(MAX_SNAPSHOT_ELEMENTS, Math.floor(value))) : DEFAULT_SNAPSHOT_ELEMENTS;

const scannedLimit = (value?: number) => typeof value === "number" && Number.isFinite(value)
  ? Math.max(0, Math.min(MAX_SNAPSHOT_SCANNED_ELEMENTS, Math.floor(value))) : MAX_SNAPSHOT_SCANNED_ELEMENTS;

const captureElements = (options: FrameSnapshotOptions) => {
  const limit = snapshotLimit(options.maxElements);
  const scanLimit = scannedLimit(options.maxScannedElements);
  const byteLimit = snapshotCatalogByteLimit(options.maxCatalogBytes);
  const walkers = [document.createTreeWalker(document, NodeFilter.SHOW_ELEMENT)];
  const observed: Element[] = [];
  const elements: CatalogElement[] = [];
  let encodedBytes = 0;
  let scannedElementCount = 0;
  let stringTruncationCount = 0;
  let omittedAttributeCount = 0;
  let omittedSelectedValueCount = 0;
  let truncationReason: SnapshotCatalogMetadata["truncationReason"];
  while (walkers.length) {
    const element = walkers[walkers.length - 1].nextNode() as Element | null;
    if (!element) { walkers.pop(); continue; }
    if (elements.length >= limit) { truncationReason = "maxElements"; break; }
    if (scannedElementCount >= scanLimit) { truncationReason = "maxScannedElements"; break; }
    scannedElementCount += 1;
    const visible = isElementVisible(element);
    element.shadowRoot && walkers.push(document.createTreeWalker(element.shadowRoot, NodeFilter.SHOW_ELEMENT));
    if (!options.includeHidden && !visible) continue;
    const output = createCatalogElement(element, visible);
    const additionalBytes = snapshotEncodedBytes(output.descriptor) + Number(elements.length > 0);
    if (encodedBytes + additionalBytes > byteLimit) { truncationReason = "maxBytes"; break; }
    elements.push(output.descriptor);
    observed.push(element);
    encodedBytes += additionalBytes;
    stringTruncationCount += output.truncatedStrings;
    omittedAttributeCount += output.omittedAttributes;
    omittedSelectedValueCount += output.omittedSelectedValues;
  }
  trackObservedElements(observed);
  pruneRegistry();
  return {
    elements,
    catalog: {
      byteLimit, encodedBytes, returnedElementCount: elements.length, scannedElementCount, scannedElementLimit: scanLimit,
      stringTruncationCount, omittedAttributeCount, omittedSelectedValueCount,
      truncated: Boolean(truncationReason), ...(truncationReason && { truncationReason }),
    },
  };
};

export const createFrameSnapshot = (frameId?: number, documentId?: string, options: FrameSnapshotOptions = {}): FrameSnapshot => {
  let revision = getRevision();
  let captured = captureElements(options);
  if (revision !== getRevision()) {
    revision = getRevision();
    captured = captureElements(options);
  }
  const limiter = createSnapshotStringLimiter();
  const url = limiter.limit(location.href)!;
  const title = limiter.limit(document.title)!;
  captured.catalog.stringTruncationCount += limiter.stats.truncatedStrings;
  return {
    frameId: frameId ?? 0,
    documentId,
    url,
    title,
    revision: getRevision(),
    ...captured,
  };
};
