import { modifierMask } from "./modifiers";
import { normalizeKeyName } from "./key-map.js";

const held = new Map<number, Set<string>>();
chrome.debugger.onDetach.addListener((source) => source.tabId !== undefined && held.delete(source.tabId));
chrome.webNavigation.onCommitted.addListener((details) => details.frameId === 0 && held.delete(details.tabId));

export const normalizeHeldKey = (value: string) => normalizeKeyName(value);
export const heldModifierMask = (tabId: number) => modifierMask([...(held.get(tabId) || [])]);
export const isHeldKey = (tabId: number, key: string) => held.get(tabId)?.has(key) === true;
export const holdModifier = (tabId: number, key: string) => {
  const keys = held.get(tabId) || new Set<string>();
  keys.add(key); held.set(tabId, keys);
};
export const releaseModifier = (tabId: number, key: string) => {
  const keys = held.get(tabId);
  keys?.delete(key);
  if (keys?.size === 0) held.delete(tabId);
};
export const takeHeldKeys = () => {
  return [...held].map(([tabId, keys]) => ({ tabId, keys: [...keys] }));
};
