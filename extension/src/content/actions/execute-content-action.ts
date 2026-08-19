import type { ActionRequest, ActionResult } from "../../../../src/types/action.js";
import { MAX_CONTENT_ERROR_CHARACTERS, MAX_CONTENT_RESULT_BYTES } from "../../../../src/protocol/limits.js";
import { resolveTarget } from "../catalog/resolve-target";
import { getRevision } from "../observation/revision";
import { compoundActionHandlers } from "./compoundActions";
import { cacheStorageActionHandlers } from "./cacheStorageActions";
import { domPointerActionHandlers } from "./domPointerActions";
import { domMutationActionHandlers } from "./dom-mutation-actions";
import { eventActionHandlers } from "./eventActions";
import { fileActionHandlers } from "./fileActions";
import { formActionHandlers } from "./formActions";
import { inspectionActionHandlers } from "./inspectionActions";
import { indexedDbActionHandlers } from "./indexedDbActions";
import { mediaActionHandlers } from "./mediaActions";
import { scrollActionHandlers } from "./scrollActions";
import { storageActionHandlers } from "./storageActions";
import { textActionHandlers } from "./textActions";
import type { ContentActionHandler } from "./types.js";
import { waitActionHandlers } from "./waitActions";
import { isContentSizeError, toJsonValue } from "./element.js";

const handlers: Record<string, ContentActionHandler> = {
  ...compoundActionHandlers,
  ...cacheStorageActionHandlers,
  ...domPointerActionHandlers,
  ...domMutationActionHandlers,
  ...eventActionHandlers,
  ...fileActionHandlers,
  ...formActionHandlers,
  ...indexedDbActionHandlers,
  ...mediaActionHandlers,
  ...inspectionActionHandlers,
  ...scrollActionHandlers,
  ...storageActionHandlers,
  ...textActionHandlers,
  ...waitActionHandlers,
};

export const executeContentAction = async (request: ActionRequest, signal: AbortSignal): Promise<ActionResult> => {
  const started = performance.now();
  const revision = getRevision();
  let resolvingInitialTarget = false;
  try {
    signal.throwIfAborted();
    let revalidate = request.expectedRevision !== undefined && request.expectedRevision !== revision;
    const resolve = () => {
      const element = request.target ? resolveTarget(request.target, revalidate) : undefined;
      revalidate = false;
      return element;
    };
    const handler = handlers[request.action];
    if (!handler) throw new Error(`Content action is not implemented: ${request.action}`);
    resolvingInitialTarget = true;
    const target = resolve();
    if (!target && (request.target?.elementId || request.target?.locator || request.target?.x !== undefined)) throw new Error("The target element is missing or stale.");
    resolvingInitialTarget = false;
    const data = await handler({ request, target, resolveTarget: resolve, signal });
    return toJsonValue({
      id: request.id, success: true, engine: "dom", data, revision: getRevision(), durationMs: performance.now() - started,
    }, MAX_CONTENT_RESULT_BYTES, "Content action result") as unknown as ActionResult;
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Content action failed.";
    const message = rawMessage.length <= MAX_CONTENT_ERROR_CHARACTERS ? rawMessage : "Content action failed with an oversized error message.";
    return {
      id: request.id,
      success: false,
      engine: "dom",
      error: { code: resolvingInitialTarget ? "TARGET_RESOLUTION_FAILED" : isContentSizeError(error) ? "CONTENT_RESULT_TOO_LARGE" : /stale|missing|timed out/i.test(message) ? "STALE_OR_TIMEOUT" : "CONTENT_ACTION_FAILED", message, retryable: resolvingInitialTarget || /stale|missing|timed out/i.test(message) },
      revision: getRevision(),
      durationMs: performance.now() - started,
    };
  }
};
