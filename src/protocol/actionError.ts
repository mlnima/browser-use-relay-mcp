import { MAX_RELAY_ERROR_CHARACTERS, MAX_RELAY_IDENTIFIER_CHARACTERS } from "./limits.js";
import type { ActionError } from "../types/action.js";
import type { JsonValue } from "../types/json.js";

const clipped = (value: string, maximum: number) => value.length <= maximum
  ? value
  : `${value.slice(0, maximum - 1)}…`;

export const boundedErrorCode = (value: unknown) => clipped(
  typeof value === "string" && value ? value : "ACTION_FAILED",
  MAX_RELAY_IDENTIFIER_CHARACTERS,
);

export const boundedErrorMessage = (value: unknown) => clipped(
  typeof value === "string" && value ? value : "Action failed.",
  MAX_RELAY_ERROR_CHARACTERS,
);

export const boundedErrorDetails = (value: JsonValue): JsonValue => {
  if (typeof value === "string") return clipped(value, MAX_RELAY_ERROR_CHARACTERS);
  if (Array.isArray(value)) return value.map((item) => boundedErrorDetails(item));
  if (value && typeof value === "object") return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [clipped(key, MAX_RELAY_ERROR_CHARACTERS), boundedErrorDetails(item)]),
  );
  return value;
};

export const errorDetailsStringsFit = (value: JsonValue) => {
  const pending = [value];
  while (pending.length) {
    const item = pending.pop()!;
    if (typeof item === "string" && item.length > MAX_RELAY_ERROR_CHARACTERS) return false;
    if (Array.isArray(item)) for (const child of item) pending.push(child);
    else if (item && typeof item === "object") for (const [key, child] of Object.entries(item)) {
      if (key.length > MAX_RELAY_ERROR_CHARACTERS) return false;
      pending.push(child);
    }
  }
  return true;
};

export const boundedActionError = (error: ActionError): ActionError => ({
  code: boundedErrorCode(error.code),
  message: boundedErrorMessage(error.message),
  retryable: error.retryable === true,
  ...(error.details === undefined ? {} : { details: boundedErrorDetails(error.details) }),
});
