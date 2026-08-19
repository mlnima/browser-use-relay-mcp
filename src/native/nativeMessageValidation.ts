import { MAX_CANCEL_REASON_LENGTH } from "../protocol/limits.js";
import type { NativeMessage } from "../types/relay.js";
import { isActionRequest, isActionResult } from "./actionValidation.js";
import { isJsonValue, isObjectRecord } from "./jsonValueValidation.js";

const isSettings = (value: unknown) => isObjectRecord(value) && typeof value.enabled === "boolean" &&
  typeof value.externalAccess === "boolean" && (value.port === undefined ||
    typeof value.port === "number" && Number.isSafeInteger(value.port) && value.port > 0 && value.port <= 65_535);
const isGeneration = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const isCancel = (value: Record<string, unknown>) => typeof value.id === "string" && Boolean(value.id) &&
  (value.reason === undefined || typeof value.reason === "string" && value.reason.length <= MAX_CANCEL_REASON_LENGTH);

export const isBrowserNativeMessage = (value: unknown): value is NativeMessage => {
  if (!isObjectRecord(value) || typeof value.type !== "string") return false;
  switch (value.type) {
    case "configure": return isGeneration(value.generation) && isSettings(value.settings);
    case "quiesce": return isGeneration(value.generation);
    case "actionRequest": return isActionRequest(value.request);
    case "actionResult": return isActionResult(value.result);
    case "cancel": return isCancel(value);
    case "event": return typeof value.name === "string" && Boolean(value.name) &&
      (value.data === undefined || isJsonValue(value.data));
    default: return false;
  }
};
