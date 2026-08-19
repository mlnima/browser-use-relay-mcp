import type { ActionLocator } from "../../../../src/types/action.js";
import { getAccessibleName, getLabelText } from "./accessible-name.js";
import { getRole } from "./implicit-role.js";
import { getElementText, includesText } from "./text.js";

const includesValue = (value: string | undefined, expected: string | undefined): boolean =>
  expected === undefined || includesText(value, expected);

export const matchesLocator = (element: Element, locator: ActionLocator): boolean => {
  if (locator.text !== undefined && !includesText(getElementText(element), locator.text, locator.exactText)) return false;
  if (!includesValue(getRole(element), locator.role)) return false;
  if (!includesValue(getAccessibleName(element), locator.name)) return false;
  if (!includesValue(getLabelText(element), locator.label)) return false;
  const placeholder = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
    ? element.placeholder
    : undefined;
  return includesValue(placeholder, locator.placeholder);
};
