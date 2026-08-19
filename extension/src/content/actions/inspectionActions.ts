import type { ContentActionHandler } from "./types.js";
import { DEFAULT_SNAPSHOT_ELEMENTS, MAX_CONTENT_JSON_ITEMS, MAX_CONTENT_VALUE_BYTES, MAX_SNAPSHOT_CATALOG_BYTES } from "../../../../src/protocol/limits.js";
import { describeElement } from "./element-data";
import { requireElement, toJsonValue } from "./element";
import { createFrameSnapshot } from "../catalog/frame-snapshot";
import { resolveRelatedElement, type ElementRelationship } from "../catalog/relationship";
import { getDeepActiveElement } from "../catalog/element-tree";
import { createPageState } from "../catalog/page-state";
import { isElementVisible } from "../catalog/element-state";
import { getPageErrors, getRevision } from "../observation/revision";
import { assertHtmlReadBounded } from "../catalog/text.js";
import { waitForRevision } from "../observation/wait-revision";
import { queryAll } from "./query-all";
import { matchesVisibleText, renderedText, resolveVisibleText } from "./visible-text-query";
import { getActionableBounds, getElementPath } from "./actionable-element";

const styleValues = (element: Element, properties: string[]) => {
  const style = getComputedStyle(element);
  return Object.fromEntries(properties.map((property) => [property, style.getPropertyValue(property)]));
};
const boundedRead = (value: unknown, label: string) => toJsonValue(value, MAX_CONTENT_VALUE_BYTES, `${label} result`);
const classValues = (element: Element) => {
  if (element.classList.length > MAX_CONTENT_JSON_ITEMS) throw new Error(`getClasses exceeds the ${MAX_CONTENT_JSON_ITEMS}-item limit.`);
  return boundedRead(Array.from(element.classList), "getClasses");
};
const htmlValue = (element: Element) => {
  assertHtmlReadBounded(element, MAX_CONTENT_VALUE_BYTES, "getHTML result");
  return boundedRead(element.outerHTML, "getHTML");
};

export const inspectionActionHandlers: Record<string, ContentActionHandler> = {
  snapshot: async ({ request }) => {
    return createFrameSnapshot(request.target?.frameId, request.target?.documentId, {
      includeHidden: request.params?.includeHidden === true,
      maxElements: Number(request.params?.maxElements ?? DEFAULT_SNAPSHOT_ELEMENTS),
      maxCatalogBytes: Number(request.params?.maxCatalogBytes ?? MAX_SNAPSHOT_CATALOG_BYTES),
      maxScannedElements: request.params?.maxScannedElements === undefined ? undefined : Number(request.params.maxScannedElements),
    });
  },
  querySelector: async ({ resolveTarget }) => describeElement(resolveTarget()),
  querySelectorAll: async ({ request }) => queryAll(String(request.target?.locator?.selector || request.params?.selector || "*"), request.params?.limit, request.params?.offset),
  queryXPath: async ({ resolveTarget }) => describeElement(resolveTarget()),
  queryText: async ({ request, resolveTarget }) => {
    const locator = request.target?.locator;
    let element = resolveTarget();
    if (!request.target?.elementId && locator?.text !== undefined) element = resolveVisibleText(locator);
    let visible = Boolean(element && isElementVisible(element));
    if (element && locator?.text !== undefined) visible = matchesVisibleText(element, locator);
    return describeElement(visible ? element : undefined);
  },
  queryRole: async ({ resolveTarget }) => describeElement(resolveTarget()),
  queryLabel: async ({ resolveTarget }) => describeElement(resolveTarget()),
  queryPlaceholder: async ({ resolveTarget }) => describeElement(resolveTarget()),
  queryCoordinates: async ({ resolveTarget }) => describeElement(resolveTarget()),
  findInFrame: async ({ resolveTarget }) => describeElement(resolveTarget()),
  getBoundingBox: async ({ target, request }) => {
    if (request.params?.actionable === true) return getActionableBounds(target);
    const element = requireElement(target);
    const bounds = element.getBoundingClientRect();
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, path: getElementPath(element) };
  },
  getElementState: async ({ target }) => describeElement(requireElement(target)),
  getText: async ({ target }) => boundedRead(renderedText(requireElement(target)), "getText"),
  getHTML: async ({ target }) => htmlValue(requireElement(target)),
  getAttribute: async ({ target, request }) => boundedRead(requireElement(target).getAttribute(String(request.params?.name ?? "")), "getAttribute"),
  getProperty: async ({ target, request }) => boundedRead((requireElement(target) as unknown as Record<string, unknown>)[String(request.params?.name ?? "")], "getProperty"),
  getClasses: async ({ target }) => classValues(requireElement(target)),
  getComputedStyle: async ({ target, request }) => boundedRead(styleValues(requireElement(target), (request.params?.properties as string[]) || []), "getComputedStyle"),
  getFocusedElement: async () => describeElement(getDeepActiveElement()),
  traverse: async ({ target, request }) => describeElement(resolveRelatedElement(requireElement(target), {
    relationship: String(request.params?.relationship ?? "parent") as ElementRelationship,
    locator: request.params?.locator as never,
    nth: Number(request.params?.index ?? 0),
  })),
  getPageState: async () => createPageState(),
  observePage: async ({ request, signal }) => {
    const sinceRevision = request.params?.sinceRevision;
    if (typeof sinceRevision !== "number") return { revision: getRevision(), page: createPageState(), errors: getPageErrors() };
    const change = await waitForRevision(sinceRevision, request.timeoutMs ?? 30_000, signal);
    return { ...change, page: createPageState(), errors: getPageErrors(sinceRevision) };
  },
};
