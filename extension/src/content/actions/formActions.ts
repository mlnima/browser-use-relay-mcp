import type { ContentActionHandler } from "./types.js";
import { MAX_INPUT_ACTION_STEPS, MAX_SNAPSHOT_SELECTED_VALUES, MAX_SNAPSHOT_STRING_CHARACTERS } from "../../../../src/protocol/limits.js";
import { createSnapshotStringLimiter } from "../../shared/snapshot-limit.js";
import { dispatchValueEvents, requireElement, requireHtmlElement, requireInput } from "./element.js";
import { isElementEnabled, isElementReadonly } from "../catalog/element-state.js";
const enabledInput = (target: Element | undefined, type: string, writable = false) => {
  const input = requireInput(target);
  if (input.type !== type) throw new Error(`The target must be an input of type ${type}.`);
  if (!isElementEnabled(input)) throw new Error("The target input is disabled.");
  if (writable && isElementReadonly(input)) throw new Error("The target input is readonly.");
  return input;
};
const setChecked = (target: Element | undefined, type: string, checked: boolean) => {
  const input = enabledInput(target, type);
  if (input.checked !== checked) input.click();
  if (input.checked !== checked) throw new Error(`The ${type} did not reach the requested checked state.`); return input.checked;
};
const setInputValue = (target: Element | undefined, type: string, value: unknown) => {
  if (value === undefined) throw new Error(`${type} requires params.value.`);
  const input = enabledInput(target, type, true); const requested = String(value ?? "");
  const expected = type === "color" ? requested.toLowerCase() : requested;
  const probe = document.createElement("input"); probe.type = type; probe.min = input.min; probe.max = input.max; probe.step = input.step; probe.value = requested;
  if (probe.value !== expected || probe.validity.badInput || probe.validity.rangeOverflow || probe.validity.rangeUnderflow || probe.validity.stepMismatch) throw new Error(`The requested ${type} value is invalid or outside the accepted range.`);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("The input value setter is unavailable.");
  setter.call(input, expected);
  if (input.value !== expected) throw new Error(`The ${type} input rejected the requested value.`);
  dispatchValueEvents(input);
  if (input.value !== expected) throw new Error(`The ${type} input did not retain the requested value.`);
  return input.value;
};
const changeOption = (target: Element | undefined, values: string[], selected: boolean) => {
  const element = requireElement(target);
  if (!(element instanceof HTMLSelectElement)) throw new Error("The target is not a select control.");
  if (!isElementEnabled(element)) throw new Error("The target select is disabled.");
  if (!values.length) throw new Error("At least one option value is required.");
  if (!element.multiple && (!selected || values.length > 1)) throw new Error("Deselecting or selecting multiple values requires a multi-select.");
  const options = [...element.options], resolved = values.map((value) => options.filter((option) => option.value === String(value) || option.text === String(value)));
  if (resolved.some((matches) => matches.length !== 1)) throw new Error("Every requested option token must resolve to exactly one option.");
  const matches = [...new Set(resolved.flat())];
  if (!element.multiple && matches.length !== 1) throw new Error("The requested option is ambiguous in this single-select.");
  if (matches.some((option) => !isElementEnabled(option))) throw new Error("A requested option is disabled.");
  matches.forEach((option) => { option.selected = selected; });
  dispatchValueEvents(element);
  if (matches.some((option) => option.selected !== selected)) throw new Error("The requested option state was not retained.");
  const limiter = createSnapshotStringLimiter(); const count = Math.min(element.selectedOptions.length, MAX_SNAPSHOT_SELECTED_VALUES);
  const selectedValues = Array.from({ length: count }, (_, index) => limiter.limit(element.selectedOptions.item(index)!.value)!);
  return {
    selectedValues, totalSelectedValueCount: element.selectedOptions.length,
    omittedSelectedValueCount: element.selectedOptions.length - count,
    outputLimits: {
      selectedValueLimit: MAX_SNAPSHOT_SELECTED_VALUES,
      stringCharacterLimit: MAX_SNAPSHOT_STRING_CHARACTERS,
      stringTruncationCount: limiter.stats.truncatedStrings,
    },
  };
};
const optionValues = (values: unknown, value: unknown) => {
  if (!Array.isArray(values) && value === undefined) throw new Error("selectOption requires params.value or params.values.");
  return Array.isArray(values) ? values.map(String) : [String(value)];
};
const stepNumber = (target: Element | undefined, value: unknown, direction: 1 | -1) => {
  const input = enabledInput(target, "number", true); const steps = value ?? 1;
  if (typeof steps !== "number" || !Number.isSafeInteger(steps) || steps < 1 || steps > MAX_INPUT_ACTION_STEPS) throw new Error(`steps must be an integer from 1 to ${MAX_INPUT_ACTION_STEPS}.`);
  direction > 0 ? input.stepUp(steps) : input.stepDown(steps); dispatchValueEvents(input); return input.value;
};
const formControl = (target: Element | undefined, types: string[]) => {
  const element = requireHtmlElement(target);
  if (!(element instanceof HTMLInputElement || element instanceof HTMLButtonElement) || !types.includes(element.type)) throw new Error(`The target must be a ${types.join(" or ")} form control.`);
  if (!isElementEnabled(element) || !element.form) throw new Error("The form control is disabled or not associated with a form.");
  return { element, form: element.form };
};
export const formActionHandlers: Record<string, ContentActionHandler> = {
  check: async ({ target }) => setChecked(target, "checkbox", true),
  uncheck: async ({ target }) => setChecked(target, "checkbox", false),
  toggleCheckbox: async ({ target }) => setChecked(target, "checkbox", !enabledInput(target, "checkbox").checked),
  selectRadio: async ({ target }) => setChecked(target, "radio", true),
  selectOption: async ({ target, request }) => changeOption(target, optionValues(request.params?.values, request.params?.value), true),
  deselectOption: async ({ target, request }) => changeOption(target, optionValues(request.params?.values, request.params?.value), false),
  setRange: async ({ target, request }) => setInputValue(target, "range", request.params?.value),
  setNumber: async ({ target, request }) => setInputValue(target, "number", request.params?.value),
  setDate: async ({ target, request }) => setInputValue(target, "date", request.params?.value),
  setTime: async ({ target, request }) => setInputValue(target, "time", request.params?.value),
  setDatetime: async ({ target, request }) => setInputValue(target, "datetime-local", request.params?.value),
  setMonth: async ({ target, request }) => setInputValue(target, "month", request.params?.value),
  setWeek: async ({ target, request }) => setInputValue(target, "week", request.params?.value),
  setColor: async ({ target, request }) => setInputValue(target, "color", request.params?.value),
  increment: async ({ target, request }) => stepNumber(target, request.params?.steps, 1),
  decrement: async ({ target, request }) => stepNumber(target, request.params?.steps, -1),
  submitForm: async ({ target }) => {
    const { element, form } = formControl(target, ["submit", "image"]);
    form.requestSubmit(element);
    return true;
  },
  resetForm: async ({ target }) => {
    const { form } = formControl(target, ["reset"]);
    form.reset();
    return true;
  },
};
