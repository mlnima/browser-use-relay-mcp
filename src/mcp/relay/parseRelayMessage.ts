import type { ActionResult } from "../../types/action.js";
import type { RelayEvent, RelayPing, RelayPong, RelayResponse } from "../../types/relay.js";
import type { RawData } from "ws";
import { errorDetailsStringsFit } from "../../protocol/actionError.js";
import { MAX_RELAY_ERROR_CHARACTERS, MAX_RELAY_IDENTIFIER_CHARACTERS } from "../../protocol/limits.js";
import { jsonValueFitsLimits } from "../jsonValueLimits.js";

type ObjectValue = Record<string, unknown>;
export type RelayInboundMessage = RelayResponse | RelayEvent | RelayPing | RelayPong;
export type RelayHandshake = { type: "event"; name: string; data?: { protocolVersion?: string; code?: string; message?: string } };

const isObject = (value: unknown): value is ObjectValue => typeof value === "object" && value !== null && !Array.isArray(value);
const isEngine = (value: unknown) => value === "browser" || value === "dom" || value === "native";
const isOptionalRevision = (value: unknown) => value === undefined || typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const isActionError = (value: unknown) => isObject(value) && typeof value.code === "string" &&
  value.code.length > 0 && value.code.length <= MAX_RELAY_IDENTIFIER_CHARACTERS && typeof value.message === "string" &&
  value.message.length <= MAX_RELAY_ERROR_CHARACTERS && typeof value.retryable === "boolean" &&
  (value.details === undefined || jsonValueFitsLimits(value.details) && errorDetailsStringsFit(value.details));
const isActionResult = (value: unknown): value is ActionResult => isObject(value) && typeof value.id === "string" &&
  value.id.length > 0 && value.id.length <= MAX_RELAY_IDENTIFIER_CHARACTERS && typeof value.success === "boolean" && isEngine(value.engine) &&
  typeof value.durationMs === "number" && Number.isFinite(value.durationMs) && value.durationMs >= 0 &&
  isOptionalRevision(value.revision) && (value.data === undefined || jsonValueFitsLimits(value.data)) &&
  (value.success ? value.error === undefined : value.data === undefined && isActionError(value.error));

const parseObject = (data: RawData) => {
  const text = Array.isArray(data) ? Buffer.concat(data).toString("utf8") : Buffer.from(data as ArrayBuffer).toString("utf8");
  const parsed: unknown = JSON.parse(text);
  return isObject(parsed) ? parsed : undefined;
};

export const parseRelayInboundMessage = (data: RawData): RelayInboundMessage | undefined => {
  const message = parseObject(data);
  if (!message || typeof message.type !== "string") return undefined;
  if (message.type === "result") return isActionResult(message.result) ? { type: "result", result: message.result } : undefined;
  if (message.type === "event") return typeof message.name === "string" && message.name.length > 0 &&
    message.name.length <= MAX_RELAY_IDENTIFIER_CHARACTERS &&
    (message.data === undefined || jsonValueFitsLimits(message.data)) ? message as RelayEvent : undefined;
  if (message.type === "ping" || message.type === "pong") return typeof message.sentAt === "number" &&
    Number.isFinite(message.sentAt) ? message as RelayPing | RelayPong : undefined;
  return undefined;
};

export const parseRelayHandshake = (data: RawData): RelayHandshake | undefined => {
  const message = parseObject(data);
  if (!message || message.type !== "event" || typeof message.name !== "string" || !message.name ||
    message.name.length > MAX_RELAY_IDENTIFIER_CHARACTERS) return undefined;
  const dataValue = message.data;
  if (dataValue !== undefined && (!isObject(dataValue) || !jsonValueFitsLimits(dataValue))) return undefined;
  if (isObject(dataValue) && dataValue.protocolVersion !== undefined && typeof dataValue.protocolVersion !== "string") return undefined;
  if (isObject(dataValue) && dataValue.code !== undefined && (typeof dataValue.code !== "string" ||
    dataValue.code.length > MAX_RELAY_IDENTIFIER_CHARACTERS)) return undefined;
  if (isObject(dataValue) && dataValue.message !== undefined && (typeof dataValue.message !== "string" ||
    dataValue.message.length > MAX_RELAY_ERROR_CHARACTERS)) return undefined;
  return message as RelayHandshake;
};
