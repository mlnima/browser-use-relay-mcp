import { randomUUID } from "node:crypto";
import type { ActionEngine, ActionRequest, ActionTarget } from "../types/action.js";
import type { JsonValue } from "../types/json.js";
import { DEFAULT_SNAPSHOT_ELEMENTS, MAX_SNAPSHOT_CATALOG_BYTES, MAX_SNAPSHOT_CATALOG_WITH_SCREENSHOT_BYTES, MAX_SNAPSHOT_ELEMENTS, MAX_SNAPSHOT_SCANNED_ELEMENTS } from "../protocol/limits.js";

type Input = {
  action: string;
  engine?: ActionEngine;
  target?: ActionTarget;
  params?: Record<string, JsonValue>;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  expectedRevision?: number;
};

const boundedInteger = (value: JsonValue | undefined, fallback: number, maximum: number) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.max(1, Math.min(maximum, Math.floor(numberValue))) : fallback;
};

const actionParams = (input: Input) => input.action === "snapshot" ? {
  ...input.params,
  includeScreenshot: input.params?.includeScreenshot === true,
  includeHidden: input.params?.includeHidden === true,
  allFrames: input.params?.allFrames === true,
  maxElements: boundedInteger(input.params?.maxElements, DEFAULT_SNAPSHOT_ELEMENTS, MAX_SNAPSHOT_ELEMENTS),
  maxCatalogBytes: boundedInteger(
    input.params?.maxCatalogBytes,
    input.params?.includeScreenshot === true ? MAX_SNAPSHOT_CATALOG_WITH_SCREENSHOT_BYTES : MAX_SNAPSHOT_CATALOG_BYTES,
    input.params?.includeScreenshot === true ? MAX_SNAPSHOT_CATALOG_WITH_SCREENSHOT_BYTES : MAX_SNAPSHOT_CATALOG_BYTES,
  ),
  maxScannedElements: boundedInteger(input.params?.maxScannedElements, MAX_SNAPSHOT_SCANNED_ELEMENTS, MAX_SNAPSHOT_SCANNED_ELEMENTS),
} : input.params;

export const createActionRequest = (input: Input): ActionRequest => ({
  id: randomUUID(),
  action: input.action,
  engine: input.engine || "auto",
  target: input.target,
  params: actionParams(input),
  timeoutMs: input.timeoutMs,
  retries: input.retries,
  retryDelayMs: input.retryDelayMs,
  expectedRevision: input.expectedRevision,
});
