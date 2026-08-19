import { errorDetailsStringsFit } from "../protocol/actionError.js";
import { MAX_RELAY_ERROR_CHARACTERS, MAX_RELAY_IDENTIFIER_CHARACTERS, MAX_TIMER_MS } from "../protocol/limits.js";
import type { ActionError, ActionLocator, ActionRequest, ActionResult, ActionTarget } from "../types/action.js";
import { isJsonValue, isObjectRecord } from "./jsonValueValidation.js";

const engines = new Set(["auto", "browser", "dom", "native"]);
const resultEngines = new Set(["browser", "dom", "native"]);
const locatorStrategies = ["selector", "xpath", "text", "role", "name", "label", "placeholder"];
const locatorKeys = new Set([...locatorStrategies, "exactText", "nth"]);
const targetKeys = new Set(["tabId", "frameId", "documentId", "elementId", "locator", "x", "y"]);
const optionalInteger = (value: unknown, minimum: number, maximum = Number.MAX_SAFE_INTEGER) =>
  value === undefined || typeof value === "number" && Number.isSafeInteger(value) && value >= minimum && value <= maximum;
const optionalNonemptyString = (value: unknown) => value === undefined || typeof value === "string" && Boolean(value);
const identifier = (value: unknown) => typeof value === "string" && value.length > 0 &&
  value.length <= MAX_RELAY_IDENTIFIER_CHARACTERS;
const optionalIdentifier = (value: unknown) => value === undefined || identifier(value);
const isLocator = (value: unknown): value is ActionLocator => {
  if (!isObjectRecord(value)) return false;
  return Object.keys(value).every((key) => locatorKeys.has(key)) &&
    locatorStrategies.some((key) => typeof value[key] === "string" && Boolean(value[key])) &&
    locatorStrategies.every((key) => optionalNonemptyString(value[key])) &&
    (value.exactText === undefined || typeof value.exactText === "boolean") && optionalInteger(value.nth, 0);
};
const isTarget = (value: unknown): value is ActionTarget => {
  if (!isObjectRecord(value)) return false;
  const coordinatesMatch = (value.x === undefined) === (value.y === undefined);
  return Object.keys(value).every((key) => targetKeys.has(key)) && optionalInteger(value.tabId, 0) &&
    optionalInteger(value.frameId, 0) && optionalIdentifier(value.documentId) && optionalIdentifier(value.elementId) &&
    (value.locator === undefined || isLocator(value.locator)) &&
    (value.x === undefined || typeof value.x === "number" && Number.isFinite(value.x)) &&
    (value.y === undefined || typeof value.y === "number" && Number.isFinite(value.y)) && coordinatesMatch;
};

export const isActionRequest = (value: unknown): value is ActionRequest => {
  if (!isObjectRecord(value)) return false;
  return identifier(value.id) && identifier(value.action) &&
    (value.engine === undefined || typeof value.engine === "string" && engines.has(value.engine)) &&
    (value.target === undefined || isTarget(value.target)) &&
    (value.params === undefined || isObjectRecord(value.params) && isJsonValue(value.params)) &&
    optionalInteger(value.timeoutMs, 1, MAX_TIMER_MS) && optionalInteger(value.retries, 0, 10) &&
    optionalInteger(value.retryDelayMs, 0, MAX_TIMER_MS) && optionalInteger(value.expectedRevision, 0);
};
const isActionError = (value: unknown): value is ActionError => isObjectRecord(value) &&
  identifier(value.code) && typeof value.message === "string" && value.message.length <= MAX_RELAY_ERROR_CHARACTERS &&
  typeof value.retryable === "boolean" && (value.details === undefined ||
    isJsonValue(value.details) && errorDetailsStringsFit(value.details));
export const isActionResult = (value: unknown): value is ActionResult => {
  if (!isObjectRecord(value) || !identifier(value.id) || typeof value.success !== "boolean" ||
    typeof value.engine !== "string" || !resultEngines.has(value.engine) || typeof value.durationMs !== "number" ||
    !Number.isFinite(value.durationMs) || value.durationMs < 0 || !optionalInteger(value.revision, 0) ||
    value.data !== undefined && !isJsonValue(value.data)) return false;
  return value.success ? value.error === undefined : value.data === undefined && isActionError(value.error);
};
