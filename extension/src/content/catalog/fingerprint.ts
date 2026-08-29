import { getAccessibleName } from "./accessible-name.js";
import { MAX_FINGERPRINT_STRING_CHARACTERS } from "../../../../src/protocol/limits.js";
import { getComposedParent } from "./element-tree.js";
import { getRole } from "./implicit-role.js";
import { getElementText } from "./text.js";

const fingerprintAttributes = [
  "id", "name", "type", "role", "aria-label", "aria-labelledby", "placeholder", "title", "alt", "href",
];
const fingerprintSiblingLimit = 64;

export type ElementFingerprint = {
  tag: string;
  path: string;
  role?: string;
  name?: string;
  text?: string;
  attributes: Record<string, string>;
};

export type FingerprintSource = { role?: string; name?: string; text?: string };
const bounded = (value: string | undefined): string | undefined => {
  const sliced = value?.slice(0, MAX_FINGERPRINT_STRING_CHARACTERS);
  return sliced && /[\uD800-\uDBFF]$/.test(sliced) ? sliced.slice(0, -1) : sliced;
};

const getPathPart = (element: Element): string => {
  let index = 1;
  let sibling = element.previousElementSibling;
  while (sibling && index < fingerprintSiblingLimit) {
    sibling.tagName === element.tagName && (index += 1);
    sibling = sibling.previousElementSibling;
  }
  return `${element.localName}:${index}`;
};

const getElementPath = (element: Element): string => {
  const parts: string[] = [];
  let current: Element | undefined = element;
  while (current && parts.length < 8) {
    parts.unshift(getPathPart(current));
    current = getComposedParent(current);
  }
  return parts.join(">");
};

export const createFingerprint = (element: Element, source?: FingerprintSource): ElementFingerprint => {
  const text = bounded(source ? source.text : getElementText(element, MAX_FINGERPRINT_STRING_CHARACTERS));
  const role = bounded(source ? source.role : getRole(element));
  const name = bounded(source ? source.name : getAccessibleName(element, text ?? null, MAX_FINGERPRINT_STRING_CHARACTERS));
  return {
    tag: bounded(element.tagName)!, path: bounded(getElementPath(element))!, role, name, text,
    attributes: Object.fromEntries(fingerprintAttributes.flatMap((attribute) => {
      const value = element.getAttribute(attribute);
      return value === null ? [] : [[attribute, bounded(value)!]];
    })),
  };
};

export const scoreFingerprint = (expected: ElementFingerprint, element: Element): number => {
  const current = createFingerprint(element);
  if (current.tag !== expected.tag) return -1;
  let score = current.path === expected.path ? 12 : -4;
  if (expected.role) score += current.role === expected.role ? 4 : -4;
  if (expected.name) score += current.name === expected.name ? 10 : -5;
  if (expected.text) score += current.text === expected.text ? 8 : -3;
  for (const [name, value] of Object.entries(expected.attributes)) {
    const weight = name === "id" ? 24
      : ["name", "href", "aria-label"].includes(name) ? 10
        : ["aria-labelledby", "placeholder"].includes(name) ? 8
          : ["title", "alt"].includes(name) ? 5 : 3;
    score += current.attributes[name] === value ? weight : -weight;
  }
  return score;
};
