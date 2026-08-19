import { MAX_ACCESSIBLE_NAME_REFERENCES, MAX_SNAPSHOT_STRING_CHARACTERS } from "../../../../src/protocol/limits.js";
import { collectBoundedElementText, normalizeText } from "./text.js";

type LabelledElement = Element & { labels?: NodeListOf<HTMLLabelElement> | null };
const contentNameTags = new Set(["A", "BUTTON", "CAPTION", "H1", "H2", "H3", "H4", "H5", "H6", "LEGEND", "OPTION", "SUMMARY", "TD", "TH"]);
const contentNameRoles = new Set(["button", "checkbox", "heading", "link", "menuitem", "option", "radio", "tab", "treeitem"]);

const bounded = (value: string | null | undefined, maximum: number): string | undefined => {
  const normalized = normalizeText(value?.slice(0, maximum + 1));
  const sliced = normalized.slice(0, maximum);
  return (/[\uD800-\uDBFF]$/.test(sliced) ? sliced.slice(0, -1) : sliced) || undefined;
};

const append = (value: string, addition: string | undefined, maximum: number): string =>
  addition ? bounded(`${value} ${addition}`, maximum) || "" : value;

const getReferencedName = (element: Element, maximum: number): string | undefined => {
  const references = bounded(element.getAttribute("aria-labelledby"), maximum)?.split(/\s+/).slice(0, MAX_ACCESSIBLE_NAME_REFERENCES) || [];
  const root = element.getRootNode() as Document | ShadowRoot;
  let value = "";
  for (const id of references) {
    const reference = root.querySelector(`#${CSS.escape(id)}`);
    value = append(value, reference ? collectBoundedElementText(reference, maximum - value.length).value : undefined, maximum);
    if (value.length >= maximum) break;
  }
  return value || undefined;
};

export const getLabelText = (element: Element, maximum = MAX_SNAPSHOT_STRING_CHARACTERS): string | undefined => {
  const labels = (element as LabelledElement).labels;
  let value = "";
  for (let index = 0; labels && index < Math.min(labels.length, MAX_ACCESSIBLE_NAME_REFERENCES) && value.length < maximum; index += 1) {
    value = append(value, collectBoundedElementText(labels.item(index)!, maximum - value.length).value, maximum);
  }
  return value || undefined;
};

const getNativeName = (element: Element, maximum: number): string | undefined => {
  if (element instanceof HTMLImageElement || element instanceof HTMLAreaElement) return bounded(element.alt, maximum);
  if (element instanceof HTMLInputElement && ["button", "submit", "reset"].includes(element.type)) return bounded(element.value, maximum);
  if (element instanceof SVGElement) {
    const title = element.querySelector("title");
    return title ? collectBoundedElementText(title, maximum).value : undefined;
  }
  return undefined;
};

const supportsContentName = (element: Element): boolean => {
  const role = element.getAttribute("role")?.slice(0, MAX_SNAPSHOT_STRING_CHARACTERS + 1).trim().split(/\s+/)[0];
  return contentNameTags.has(element.tagName) || Boolean(role && contentNameRoles.has(role.toLowerCase()));
};

export const getAccessibleName = (
  element: Element,
  contentText?: string | null,
  maximum = MAX_SNAPSHOT_STRING_CHARACTERS,
): string | undefined => {
  const referenced = getReferencedName(element, maximum);
  if (referenced) return referenced;
  const explicit = bounded(element.getAttribute("aria-label"), maximum);
  if (explicit) return explicit;
  const label = getLabelText(element, maximum);
  if (label) return label;
  const native = getNativeName(element, maximum);
  if (native) return native;
  const content = supportsContentName(element) ? contentText === null ? undefined : contentText || collectBoundedElementText(element, maximum).value : undefined;
  if (content) return bounded(content, maximum);
  const title = bounded(element.getAttribute("title"), maximum);
  if (title) return title;
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? bounded(element.placeholder, maximum) : undefined;
};
