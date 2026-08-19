import { contentMessage } from "../../shared/content-messages.js";
import { getRevision, recordPageError } from "./revision.js";
import type { ObservationChange, ObservedPageError, PageErrorDetail } from "./revision.js";
import { startObservation } from "./start-observation.js";

const limitedText = (value: unknown, limit: number) => {
  try { return String(value ?? "").slice(0, limit) || undefined; } catch { return "Unserializable page error"; }
};

export const startPageEventObservation = (): (() => void) => {
  let changeTimer: number | undefined;
  const pendingReasons = new Set<string>();
  let pendingError: ObservedPageError | undefined;
  const publishChange = (change?: ObservationChange) => {
    change?.reasons.forEach((reason) => pendingReasons.add(reason));
    changeTimer !== undefined && window.clearTimeout(changeTimer);
    changeTimer = window.setTimeout(() => {
      const reasons = [...pendingReasons];
      const error = pendingError;
      pendingReasons.clear();
      pendingError = undefined;
      void chrome.runtime.sendMessage({
        type: contentMessage.changed,
        revision: getRevision(),
        url: location.href,
        reasons,
        ...(error && { error }),
      }).catch(() => (reasons.forEach((reason) => pendingReasons.add(reason)), pendingError ||= error));
    }, 100);
  };
  const publishError = (error: PageErrorDetail) => (pendingError = recordPageError(error), publishChange());
  const onError = (event: ErrorEvent) => publishError({
    message: limitedText(event.message, 8_192) || "Page error",
    source: limitedText(event.filename, 2_048),
    line: event.lineno || undefined,
    column: event.colno || undefined,
    stack: limitedText(event.error instanceof Error ? event.error.stack : undefined, 65_536),
  });
  const onRejection = (event: PromiseRejectionEvent) => publishError({
    message: limitedText(event.reason instanceof Error ? event.reason.message : event.reason, 8_192) || "Unhandled rejection",
    stack: limitedText(event.reason instanceof Error ? event.reason.stack : undefined, 65_536),
  });
  const stopObservation = startObservation(publishChange);
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    stopObservation();
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    changeTimer !== undefined && window.clearTimeout(changeTimer);
    pendingReasons.clear();
    pendingError = undefined;
  };
};
