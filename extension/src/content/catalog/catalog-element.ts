import type { CatalogElement } from "../../../../src/types/snapshot.js";
import { MAX_SNAPSHOT_ATTRIBUTES, MAX_SNAPSHOT_SELECTED_VALUES, MAX_SNAPSHOT_STRING_CHARACTERS } from "../../../../src/protocol/limits.js";
import { createSnapshotStringLimiter } from "../../shared/snapshot-limit.js";
import { getAccessibleName } from "./accessible-name.js";
import { getElementBounds, isElementEditable, isElementEnabled, isElementReadonly, isElementVisible } from "./element-state.js";
import { getRole } from "./implicit-role.js";
import { registerElement } from "./registry.js";
import { collectBoundedElementText } from "./text.js";

type Stats = { omittedAttributes: number; omittedSelectedValues: number };
type LimitString = ReturnType<typeof createSnapshotStringLimiter>["limit"];
const structuralTextTags = new Set([
  "HTML", "BODY", "DIV", "MAIN", "SECTION", "ARTICLE", "ASIDE", "HEADER", "FOOTER", "NAV", "FORM",
  "TABLE", "THEAD", "TBODY", "TFOOT", "TR", "UL", "OL", "DL", "FIELDSET",
]);

const getAttributes = (element: Element, limit: LimitString, stats: Stats): Record<string, string> | undefined => {
  const attributes = Object.create(null) as Record<string, string>;
  const count = Math.min(element.attributes.length, MAX_SNAPSHOT_ATTRIBUTES);
  stats.omittedAttributes += element.attributes.length - count;
  for (let index = 0; index < count; index += 1) {
    const attribute = element.attributes.item(index)!;
    const name = limit(attribute.name)!;
    if (Object.hasOwn(attributes, name)) stats.omittedAttributes += 1;
    else attributes[name] = limit(attribute.value)!;
  }
  return Object.keys(attributes).length ? attributes : undefined;
};

const getValue = (element: Element, contentText?: string): string | undefined => {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) return element.value;
  if (element instanceof HTMLSelectElement) return element.value;
  if (element instanceof HTMLElement && element.isContentEditable) return contentText;
  return undefined;
};

const getHref = (element: Element): string | undefined => {
  if (element instanceof HTMLAnchorElement || element instanceof HTMLAreaElement || element instanceof HTMLLinkElement) {
    return element.href || undefined;
  }
  return undefined;
};

const getPlaceholder = (element: Element): string | undefined =>
  element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
    ? element.placeholder || undefined
    : undefined;

const getSelectedValues = (element: Element, limit: LimitString, stats: Stats): string[] | undefined => {
  if (!(element instanceof HTMLSelectElement)) return undefined;
  const count = Math.min(element.selectedOptions.length, MAX_SNAPSHOT_SELECTED_VALUES);
  stats.omittedSelectedValues += element.selectedOptions.length - count;
  return Array.from({ length: count }, (_, index) => limit(element.selectedOptions.item(index)!.value)!);
};

export const createCatalogElement = (element: Element, visible = isElementVisible(element)) => {
  const limiter = createSnapshotStringLimiter();
  const stats: Stats = { omittedAttributes: 0, omittedSelectedValues: 0 };
  const textResult = collectBoundedElementText(element, MAX_SNAPSHOT_STRING_CHARACTERS + 1);
  const text = textResult.value;
  const role = getRole(element);
  const name = getAccessibleName(element, text ?? null, MAX_SNAPSHOT_STRING_CHARACTERS + 1);
  const value = getValue(element, text);
  const scanOnlyTruncation = textResult.truncated && (text?.length || 0) <= MAX_SNAPSHOT_STRING_CHARACTERS;
  if (scanOnlyTruncation) limiter.stats.truncatedStrings += 1 + Number(Boolean(text) && name === text) + Number(element instanceof HTMLElement && element.isContentEditable);
  const descriptor: CatalogElement = {
    id: registerElement(element, { role, name, text }),
    tag: limiter.limit(element.localName)!,
    role: limiter.limit(role),
    name: limiter.limit(name),
    text: limiter.limit(structuralTextTags.has(element.tagName) ? undefined : text),
    value: limiter.limit(value),
    href: limiter.limit(getHref(element)),
    placeholder: limiter.limit(getPlaceholder(element)),
    bounds: getElementBounds(element),
    visible,
    enabled: isElementEnabled(element),
    editable: isElementEditable(element),
    readonly: isElementReadonly(element),
    checked: element instanceof HTMLInputElement && ["checkbox", "radio"].includes(element.type) ? element.checked : undefined,
    selected: element instanceof HTMLOptionElement ? element.selected : undefined,
    selectedValues: getSelectedValues(element, limiter.limit, stats),
    attributes: getAttributes(element, limiter.limit, stats),
  };
  return { descriptor, truncatedStrings: limiter.stats.truncatedStrings, ...stats };
};
