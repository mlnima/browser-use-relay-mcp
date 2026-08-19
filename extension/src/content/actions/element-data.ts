import type { JsonValue } from "../../../../src/types/json.js";
import { MAX_SNAPSHOT_SELECTED_VALUES, MAX_SNAPSHOT_STRING_CHARACTERS } from "../../../../src/protocol/limits.js";
import { createSnapshotStringLimiter } from "../../shared/snapshot-limit.js";
import { getAccessibleName } from "../catalog/accessible-name.js";
import { getRole } from "../catalog/implicit-role.js";
import { registerElement } from "../catalog/registry";
import { isElementEditable, isElementEnabled, isElementReadonly, isElementVisible } from "../catalog/element-state";
import { collectBoundedElementText } from "../catalog/text.js";

export const describeElement = (element?: Element): JsonValue => {
  if (!element) return null;
  const bounds = element.getBoundingClientRect();
  const control = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement ? element : undefined;
  const typedControl = element instanceof HTMLInputElement || element instanceof HTMLButtonElement ? element : undefined;
  const formControl = element instanceof HTMLInputElement || element instanceof HTMLButtonElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement ? element : undefined;
  const textResult = collectBoundedElementText(element, MAX_SNAPSHOT_STRING_CHARACTERS + 1);
  const text = textResult.value;
  const value = control?.value ?? (element instanceof HTMLElement && element.isContentEditable ? text || "" : null);
  const fingerprintRole = getRole(element);
  const fingerprintName = getAccessibleName(element, text ?? null, MAX_SNAPSHOT_STRING_CHARACTERS + 1);
  const id = registerElement(element, { role: fingerprintRole, name: fingerprintName, text });
  const role = element.getAttribute("role");
  const limiter = createSnapshotStringLimiter();
  const selectedCount = element instanceof HTMLSelectElement ? element.selectedOptions.length : 0;
  const selectedValues = element instanceof HTMLSelectElement
    ? Array.from({ length: Math.min(selectedCount, MAX_SNAPSHOT_SELECTED_VALUES) }, (_, index) => limiter.limit(element.selectedOptions.item(index)!.value)!)
    : null;
  const scanOnlyTruncation = textResult.truncated && (text?.length || 0) <= MAX_SNAPSHOT_STRING_CHARACTERS;
  if (scanOnlyTruncation) limiter.stats.truncatedStrings += 1 + Number(element instanceof HTMLElement && element.isContentEditable);
  return {
    id,
    tag: limiter.limit(element.tagName.toLowerCase())!,
    inputType: typedControl ? limiter.limit(typedControl.type)! : null,
    contentEditable: element instanceof HTMLElement && element.isContentEditable,
    formAssociated: Boolean(formControl?.form),
    role: role === null ? null : limiter.limit(role)!,
    text: limiter.limit(text) || "",
    value: value === null ? null : limiter.limit(value)!,
    visible: isElementVisible(element),
    enabled: isElementEnabled(element),
    editable: isElementEditable(element),
    readonly: isElementReadonly(element),
    checked: element instanceof HTMLInputElement ? element.checked : null,
    selected: element instanceof HTMLOptionElement ? element.selected : null,
    selectedValues,
    bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
    outputLimits: {
      stringCharacterLimit: MAX_SNAPSHOT_STRING_CHARACTERS,
      selectedValueLimit: MAX_SNAPSHOT_SELECTED_VALUES,
      stringTruncationCount: limiter.stats.truncatedStrings,
      omittedSelectedValueCount: Math.max(0, selectedCount - MAX_SNAPSHOT_SELECTED_VALUES),
    },
  };
};
