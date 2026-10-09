import { MAX_CANCEL_REASON_LENGTH } from "../protocol/limits.js";
import type { NativeMessage } from "../types/relay.js";
import { isActionDelaySettings, isActionRequest, isActionResult } from "./actionValidation.js";
import { isJsonValue, isObjectRecord } from "./jsonValueValidation.js";
import { isInputEngine } from "../protocol/actionCatalog.js";

const isSettings = (value: unknown) => isObjectRecord(value) && typeof value.enabled === "boolean" &&
  typeof value.externalAccess === "boolean" && (value.port === undefined ||
    typeof value.port === "number" && Number.isSafeInteger(value.port) && value.port > 0 && value.port <= 65_535) &&
  isActionDelaySettings(value) && (value.inputEngine === undefined || isInputEngine(value.inputEngine));
const isGeneration = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const isCancel = (value: Record<string, unknown>) => typeof value.id === "string" && Boolean(value.id) &&
  (value.reason === undefined || typeof value.reason === "string" && value.reason.length <= MAX_CANCEL_REASON_LENGTH);

export const isBrowserNativeMessage = (value: unknown): value is NativeMessage => {
  if (!isObjectRecord(value) || typeof value.type !== "string") return false;
  switch (value.type) {
    case "configure": return isGeneration(value.generation) && isSettings(value.settings);
    case "quiesce": return isGeneration(value.generation);
    case "actionRequest": return isActionRequest(value.request) && (value.page === undefined || isObjectRecord(value.page) &&
      typeof value.page.focused === "boolean" && typeof value.page.title === "string" && typeof value.page.url === "string" &&
      typeof value.page.observation === "string" && value.page.observation.length > 0 && value.page.observation.length <= 64 &&
      [value.page.width, value.page.height, value.page.zoom].every((number) => typeof number === "number" && Number.isFinite(number) && number > 0) &&
      [value.page.tabId, value.page.windowId].every((number) => typeof number === "number" && Number.isSafeInteger(number) && number >= 0));
    case "actionResult": return isActionResult(value.result);
    case "pageInvalidated": return typeof value.observation === "string" && value.observation.length > 0 && value.observation.length <= 64 &&
      typeof value.reason === "string" && value.reason.length <= MAX_CANCEL_REASON_LENGTH;
    case "cancel": return isCancel(value);
    case "event": return typeof value.name === "string" && Boolean(value.name) &&
      (value.data === undefined || isJsonValue(value.data));
    default: return false;
  }
};
