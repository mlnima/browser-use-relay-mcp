import type { ActionRequest, ActionResult } from "../types/action.js";
import { DEFAULT_ACTION_TIMEOUT_MS } from "./constants.js";
import { cancelDownloadsByOwner, cleanupDownloads } from "./downloadSessions.js";
import { executeNativeWithRetries } from "./executeNativeWithRetries.js";
import { createNativeError, toActionError } from "./nativeError.js";
import { releaseAllNativeInput } from "./nativeInputState.js";
import { cancelUpload, cancelUploadsByOwner, cleanupUploads } from "./uploadCleanup.js";
import { stringParam } from "./nativeParams.js";

type Reply = (result: ActionResult) => void;
type ActiveAction = { controller: AbortController; owner: object; timer: NodeJS.Timeout; settled: Promise<void> };
export const createNativeRunner = () => {
  const active = new Map<string, ActiveAction>();
  let queue = Promise.resolve();
  const execute = (request: ActionRequest, owner: object, reply: Reply) => {
    const startedAt = performance.now();
    const controller = new AbortController();
    const timeoutMs = request.timeoutMs ?? DEFAULT_ACTION_TIMEOUT_MS;
    const timer = setTimeout(() => controller.abort(createNativeError(
      "ACTION_TIMEOUT", `Native action timed out after ${timeoutMs} ms.`, true,
    )), timeoutMs);
    let resolveSettled: () => void = () => undefined;
    const settled = new Promise<void>((resolve) => { resolveSettled = resolve; });
    active.set(request.id, { controller, owner, timer, settled });
    const task = queue.then(() => executeNativeWithRetries(request, controller.signal, owner));
    queue = task.then(() => undefined, () => undefined);
    void task.then((data) => reply({
      id: request.id,
      success: true,
      engine: "native",
      ...(data === undefined ? {} : { data }),
      durationMs: Math.round(performance.now() - startedAt),
    })).catch((error: unknown) => reply({
      id: request.id,
      success: false,
      engine: "native",
      error: toActionError(error),
      durationMs: Math.round(performance.now() - startedAt),
    })).finally(async () => {
      const transferId = stringParam(request, "transferId");
      if (controller.signal.aborted && transferId && request.action === "uploadFile")
        await cancelUpload(transferId, owner).catch(() => undefined);
      clearTimeout(timer);
      active.delete(request.id);
      resolveSettled();
    });
  };

  const cancel = async (id: string, reason: string, owner?: object) => {
    const action = active.get(id);
    if (!action || (owner && action.owner !== owner)) return false;
    action.controller.abort(createNativeError("ACTION_CANCELLED", reason));
    return true;
  };
  const cancelPrefix = async (id: string, reason: string, owner?: object) => {
    const ids = [...active].filter(([activeId, action]) =>
      (activeId === id || activeId.startsWith(`${id}:`)) && (!owner || action.owner === owner)).map(([activeId]) => activeId);
    for (const activeId of ids) await cancel(activeId, reason, owner);
    return ids;
  };

  const cancelOwner = async (owner: object, reason: string) => {
    const actions = [...active].filter(([, action]) => action.owner === owner);
    for (const [id] of actions) await cancel(id, reason, owner);
    await Promise.allSettled(actions.map(([, action]) => action.settled));
    await cancelUploadsByOwner(owner);
    await cancelDownloadsByOwner(owner);
  };

  const countOwner = (owner: object) => {
    let count = 0;
    for (const action of active.values()) if (action.owner === owner) count += 1;
    return count;
  };

  const close = async () => {
    const settlements = [...active.values()].map((action) => action.settled);
    for (const id of [...active.keys()]) await cancel(id, "The native host is shutting down.");
    await Promise.allSettled(settlements);
    await releaseAllNativeInput();
    await cleanupUploads();
    await cleanupDownloads();
  };

  return { execute, cancel, cancelPrefix, cancelOwner, close, has: (id: string) => active.has(id), count: () => active.size, countOwner };
};
