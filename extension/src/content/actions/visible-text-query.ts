import type { ActionLocator } from "../../../../src/types/action.js";
import { MAX_CONTENT_VALUE_BYTES } from "../../../../src/protocol/limits.js";
import { isElementVisible } from "../catalog/element-state.js";
import { resolveLocatorAll } from "../catalog/resolve-locator.js";
import { assertTextReadBounded, includesText } from "../catalog/text.js";

export const renderedText = (element: Element): string => {
  if (!isElementVisible(element)) return "";
  assertTextReadBounded(element, MAX_CONTENT_VALUE_BYTES, "Rendered text");
  return element instanceof HTMLElement ? element.innerText : element.textContent || "";
};

export const matchesVisibleText = (element: Element, locator: ActionLocator): boolean =>
  isElementVisible(element) && includesText(renderedText(element), locator.text || "", locator.exactText);

export const resolveVisibleText = (locator: ActionLocator): Element | undefined => {
  const candidates = resolveLocatorAll({ ...locator, text: undefined, exactText: undefined, nth: undefined });
  const matches = candidates.filter((element) => matchesVisibleText(element, locator));
  const nth = locator.nth ?? 0;
  const index = nth < 0 ? matches.length + nth : nth;
  return matches[index];
};
