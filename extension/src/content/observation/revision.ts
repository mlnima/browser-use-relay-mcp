import type { JsonValue } from "../../../../src/types/json.js";

export type RevisionReason =
  | "mutation"
  | "resize"
  | "intersection"
  | "navigation"
  | "scroll"
  | "viewport"
  | "visibility"
  | "input"
  | "focus"
  | "error";

export type PageErrorDetail = {
  message: string;
  source?: string;
  line?: number;
  column?: number;
  stack?: string;
};

export type ObservedPageError = PageErrorDetail & { revision: number };

export type ObservationChange = {
  revision: number;
  reasons: RevisionReason[];
  url: string;
};

type RevisionListener = (change: ObservationChange) => void;

const listeners = new Set<RevisionListener>();
const pendingReasons = new Set<RevisionReason>();
let revision = 0;
let notificationPending = false;
const pageErrors: ObservedPageError[] = [];

const notifyListeners = (): void => {
  notificationPending = false;
  const change = { revision, reasons: Array.from(pendingReasons), url: location.href };
  pendingReasons.clear();
  for (const listener of listeners) listener(change);
};

export const markRevision = (reason: RevisionReason): number => {
  revision += 1;
  pendingReasons.add(reason);
  if (!notificationPending) {
    notificationPending = true;
    queueMicrotask(notifyListeners);
  }
  return revision;
};

export const getRevision = (): number => revision;

export const recordPageError = (error: PageErrorDetail): ObservedPageError => {
  const entry: ObservedPageError = {
    message: error.message,
    revision: markRevision("error"),
    ...(error.source !== undefined && { source: error.source }),
    ...(error.line !== undefined && { line: error.line }),
    ...(error.column !== undefined && { column: error.column }),
    ...(error.stack !== undefined && { stack: error.stack }),
  };
  pageErrors.push(entry);
  pageErrors.length > 100 && pageErrors.splice(0, pageErrors.length - 100);
  return entry;
};

export const getPageErrors = (sinceRevision = -1): JsonValue[] =>
  JSON.parse(JSON.stringify(pageErrors.filter((error) => error.revision > sinceRevision))) as JsonValue[];

export const subscribeRevision = (listener: RevisionListener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
