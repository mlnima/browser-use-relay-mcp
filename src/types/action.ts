import type { JsonValue } from "./json.js";

export type ActionEngine = "auto" | "browser" | "dom" | "native";

export type ActionLocator = {
  selector?: string;
  xpath?: string;
  text?: string;
  exactText?: boolean;
  role?: string;
  name?: string;
  label?: string;
  placeholder?: string;
  nth?: number;
};

export type ActionTarget = {
  tabId?: number;
  frameId?: number;
  documentId?: string;
  elementId?: string;
  locator?: ActionLocator;
  x?: number;
  y?: number;
};

export type ActionRequest = {
  id: string;
  action: string;
  engine?: ActionEngine;
  target?: ActionTarget;
  params?: Record<string, JsonValue>;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  expectedRevision?: number;
};

export type ActionError = {
  code: string;
  message: string;
  retryable: boolean;
  details?: JsonValue;
};

export type ActionResult = {
  id: string;
  success: boolean;
  engine: Exclude<ActionEngine, "auto">;
  data?: JsonValue;
  error?: ActionError;
  revision?: number;
  durationMs: number;
};
