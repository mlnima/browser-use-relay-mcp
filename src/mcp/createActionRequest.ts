import { randomUUID } from "node:crypto";
import type { ActionEngine, ActionRequest, ActionTarget } from "../types/action.js";
import type { JsonValue } from "../types/json.js";

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

export const createActionRequest = (input: Input): ActionRequest => ({
  id: randomUUID(),
  action: input.action,
  engine: input.engine || "auto",
  target: input.target,
  params: input.params,
  timeoutMs: input.timeoutMs,
  retries: input.retries,
  retryDelayMs: input.retryDelayMs,
  expectedRevision: input.expectedRevision,
});
