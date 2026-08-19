import { createFingerprint, scoreFingerprint, type ElementFingerprint, type FingerprintSource } from "./fingerprint.js";

type RegistryEntry = {
  reference: WeakRef<Element>;
  fingerprint: ElementFingerprint;
};

export const registryLimit = 20_000;

const hashSeed = (value: string): string => {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

export const documentSeed = `d${hashSeed(`${location.href}:${performance.timeOrigin}:${crypto.randomUUID()}`)}`;
const elementIds = new WeakMap<Element, string>();
const registry = new Map<string, RegistryEntry>();
let sequence = 0;

const touchEntry = (id: string, entry: RegistryEntry): RegistryEntry => {
  registry.delete(id);
  registry.set(id, entry);
  return entry;
};

export const pruneRegistry = (limit = registryLimit): void => {
  while (registry.size > limit) registry.delete(registry.keys().next().value as string);
};

const bindElement = (id: string, element: Element, source?: FingerprintSource): string => {
  elementIds.set(element, id);
  touchEntry(id, { reference: new WeakRef(element), fingerprint: createFingerprint(element, source) });
  pruneRegistry();
  return id;
};

export const registerElement = (element: Element, source?: FingerprintSource): string => {
  const existing = elementIds.get(element);
  if (existing) return bindElement(existing, element, source);
  return bindElement(`${documentSeed}-${(++sequence).toString(36)}`, element, source);
};

export const getElementId = (element: Element): string | undefined => elementIds.get(element);

export const registerElements = (elements: Iterable<Element>): string[] =>
  Array.from(elements, (element) => registerElement(element));

export const lookupElement = (id: string): Element | undefined => {
  const entry = registry.get(id);
  const element = entry && touchEntry(id, entry).reference.deref();
  return element?.isConnected && element.ownerDocument === document ? element : undefined;
};

export const rebindElement = (id: string, element: Element): Element | undefined =>
  registry.has(id) ? (bindElement(id, element), element) : undefined;

export const revalidateElement = (id: string, candidates: Iterable<Element>): Element | undefined => {
  const entry = registry.get(id);
  const expected = entry && touchEntry(id, entry).fingerprint;
  if (!expected) return undefined;
  let best: Element | undefined;
  let bestScore = -Infinity;
  let runnerUpScore = -Infinity;
  for (const candidate of candidates) {
    const score = scoreFingerprint(expected, candidate);
    if (score > bestScore) {
      runnerUpScore = bestScore;
      best = candidate;
      bestScore = score;
    } else if (score > runnerUpScore) runnerUpScore = score;
  }
  return best && bestScore >= 8 && bestScore - runnerUpScore >= 4 ? rebindElement(id, best) : undefined;
};

export const isRegisteredElementCurrent = (id: string, element: Element): boolean => lookupElement(id) === element;

export const forgetDetachedElement = (id: string): void => {
  const element = registry.get(id)?.reference.deref();
  if (element?.isConnected) return;
  element && elementIds.delete(element);
  registry.delete(id);
};

export const getRegistrySize = (): number => registry.size;
