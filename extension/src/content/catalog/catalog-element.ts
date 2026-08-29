import type { CatalogElement } from "../../../../src/types/snapshot.js";
import { MAX_SNAPSHOT_ATTRIBUTES, MAX_SNAPSHOT_SELECTED_VALUES, MAX_SNAPSHOT_STRING_CHARACTERS } from "../../../../src/protocol/limits.js";
import { createSnapshotStringLimiter } from "../../shared/snapshot-limit.js";
import { getAccessibleName } from "./accessible-name.js";
import { isElementEditable, isElementEnabled, isElementReadonly, isElementVisible } from "./element-state.js";
import { getRole } from "./implicit-role.js";
import { registerElement } from "./registry.js";
import { collectBoundedElementText } from "./text.js";

type Stats = { omittedAttributes: number; omittedSelectedValues: number };
type LimitString = ReturnType<typeof createSnapshotStringLimiter>["limit"];
const snapshotAttributes = [
  "aria-activedescendant", "aria-busy", "aria-checked", "aria-selected", "aria-valuenow", "aria-valuetext",
  "aria-valuemin", "aria-valuemax", "aria-expanded", "aria-pressed", "aria-current", "aria-invalid", "aria-haspopup",
  "aria-controls", "aria-describedby", "aria-required", "aria-disabled", "aria-readonly", "aria-hidden", "aria-sort",
  "aria-level", "aria-orientation", "aria-multiselectable", "aria-live", "data-testid", "data-test", "data-qa",
  "tabindex", "type", "name", "id", "title", "alt", "for", "autocomplete", "inputmode", "accept", "multiple",
  "required", "min", "max", "step", "pattern",
] as const;
const structuralTextTags = new Set([
  "HTML", "BODY", "DIV", "MAIN", "SECTION", "ARTICLE", "ASIDE", "HEADER", "FOOTER", "NAV", "FORM",
  "TABLE", "THEAD", "TBODY", "TFOOT", "TR", "UL", "OL", "DL", "FIELDSET",
]);
const textlessTags = new Set(["AUDIO", "CANVAS", "EMBED", "IFRAME", "IMG", "INPUT", "OBJECT", "SELECT", "TEXTAREA", "VIDEO"]);
const targetTags = new Set(["a", "area", "audio", "button", "canvas", "details", "embed", "iframe", "img", "input", "label", "meter", "object", "option", "progress", "select", "summary", "textarea", "video"]);
const semanticAttributes = snapshotAttributes.filter((name) =>
  name.startsWith("aria-") || name === "tabindex" || name.startsWith("data-"));

const getAttributes = (element: Element, limit: LimitString, stats: Stats): Record<string, string> | undefined => {
  const attributes = Object.create(null) as Record<string, string>;
  let selected = 0;
  for (const name of snapshotAttributes) {
    if (selected >= MAX_SNAPSHOT_ATTRIBUTES) break;
    const value = element.getAttribute(name);
    if (value === null) continue;
    attributes[limit(name)!] = limit(value)!;
    selected += 1;
  }
  stats.omittedAttributes += Math.max(0, element.attributes.length - selected);
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
  const role = getRole(element);
  const textResult = textlessTags.has(element.tagName)
    ? { value: undefined, truncated: false }
    : collectBoundedElementText(element, MAX_SNAPSHOT_STRING_CHARACTERS + 1);
  const text = textResult.value;
  const name = getAccessibleName(element, text ?? null, MAX_SNAPSHOT_STRING_CHARACTERS + 1);
  const value = getValue(element, text);
  const enabled = isElementEnabled(element);
  const readonly = isElementReadonly(element);
  const editable = isElementEditable(element, enabled, readonly);
  const scanOnlyTruncation = textResult.truncated && (text?.length || 0) <= MAX_SNAPSHOT_STRING_CHARACTERS;
  if (scanOnlyTruncation) limiter.stats.truncatedStrings += 1 + Number(Boolean(text) && name === text) + Number(element instanceof HTMLElement && element.isContentEditable);
  const descriptor: CatalogElement = {
    id: registerElement(element, { role, name, text }),
    tag: limiter.limit(element.localName)!,
    role: limiter.limit(role),
    name: limiter.limit(name),
    text: limiter.limit(structuralTextTags.has(element.tagName) || name === text ? undefined : text),
    value: limiter.limit(value),
    href: limiter.limit(getHref(element)),
    placeholder: limiter.limit(getPlaceholder(element)),
    visible: visible ? undefined : false,
    enabled: enabled ? undefined : false,
    editable: editable ? true : undefined,
    readonly: readonly ? true : undefined,
    checked: element instanceof HTMLInputElement && ["checkbox", "radio"].includes(element.type) ? element.checked : undefined,
    selected: element instanceof HTMLOptionElement ? element.selected : undefined,
    selectedValues: getSelectedValues(element, limiter.limit, stats),
    attributes: getAttributes(element, limiter.limit, stats),
  };
  return { descriptor, truncatedStrings: limiter.stats.truncatedStrings, ...stats };
};

export const isPotentialCatalogElement = (element: Element) => targetTags.has(element.localName)
  || element.hasAttribute("role") || element.hasAttribute("contenteditable")
  || semanticAttributes.some((name) => element.hasAttribute(name))
  || (!structuralTextTags.has(element.tagName) && Array.from(element.childNodes).some((node) =>
    node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim())));

export const isCatalogElementMeaningful = (element: CatalogElement) => {
  const attributes = element.attributes || {};
  return targetTags.has(element.tag) || Boolean(
    element.role || element.name || element.text || element.value || element.href || element.placeholder
    || element.editable || element.checked !== undefined || element.selected !== undefined || element.selectedValues?.length
    || ["tabindex", "data-testid", "data-test", "data-qa"].some((name) => Object.hasOwn(attributes, name))
    || Object.keys(attributes).some((name) => name.startsWith("aria-")),
  );
};
