import type { ActionTarget } from "../../../../src/types/action.js";
import { MAX_TARGET_REVALIDATION_CANDIDATES } from "../../../../src/protocol/limits.js";
import { collectElementsBounded, elementFromPointOpen } from "./element-tree.js";
import { lookupElement, revalidateElement } from "./registry.js";
import { resolveLocator, resolveLocatorAll } from "./resolve-locator.js";

const resolveRegisteredTarget = (target: ActionTarget, revalidate: boolean): Element | undefined => {
  if (!target.elementId) return undefined;
  const current = lookupElement(target.elementId);
  if (!revalidate && current && (!target.locator || resolveLocatorAll(target.locator).includes(current))) return current;
  const currentMatch = current && revalidateElement(target.elementId, [current]);
  if (currentMatch && (!target.locator || resolveLocatorAll(target.locator).includes(currentMatch))) return currentMatch;
  if (target.locator) return revalidateElement(target.elementId, resolveLocatorAll(target.locator));
  const candidates = collectElementsBounded(MAX_TARGET_REVALIDATION_CANDIDATES);
  if (candidates.truncated) throw new Error(`Target revalidation exceeded the ${MAX_TARGET_REVALIDATION_CANDIDATES}-candidate limit.`);
  return revalidateElement(target.elementId, candidates.elements);
};

export const resolveTarget = (target: ActionTarget, revalidate = false): Element | undefined => {
  const registered = resolveRegisteredTarget(target, revalidate);
  if (registered) return registered;
  if (revalidate && target.elementId) throw new Error("Target element is stale or ambiguous after the page changed.");
  if (target.locator) return resolveLocator(target.locator);
  if (typeof target.x === "number" && typeof target.y === "number") {
    return elementFromPointOpen(target.x, target.y);
  }
  return undefined;
};
