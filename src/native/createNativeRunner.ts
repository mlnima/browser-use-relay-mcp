import type { ActionRequest, ActionResult } from "../types/action.js";
import { DEFAULT_ACTION_TIMEOUT_MS } from "./constants.js";
import { cancelDownloadsByOwner, cleanupDownloads } from "./downloadSessions.js";
import { executeNativeWithRetries } from "./executeNativeWithRetries.js";
import { createNativeError, toActionError } from "./nativeError.js";
import { releaseAllNativeInput, releaseNativeInputOwner, runWithNativeInputOwner } from "./nativeInputState.js";
import { cancelUpload, cancelUploadsByOwner, cleanupUploads } from "./uploadCleanup.js";
import { stringParam } from "./nativeParams.js";

type Reply = (result: ActionResult) => void;
type ActiveAction = { controller: AbortController; timer: NodeJS.Timeout; settled: Promise<void> };
export const createNativeRunner = () => {
  const active = new Map<object, Map<string, ActiveAction>>();
  let queue = Promise.resolve();
  const ownerActions = (owner: object) => {
    const current = active.get(owner);
    if (current) return current;
    const created = new Map<string, ActiveAction>();
    active.set(owner, created);
    return created;
  };
  const remove = (owner: object, id: string) => {
    const owned = active.get(owner);
    owned?.delete(id);
    if (owned && !owned.size) active.delete(owner);
  };
  const entries = () => [...active].flatMap(([owner, actions]) => [...actions].map(([id, action]) => ({ id, action, owner })));
  const append = <T>(run: () => Promise<T>) => {
    const task = queue.then(run);
    queue = task.then(() => undefined, () => undefined);
    return task;
  };
  const execute = (request: ActionRequest, owner: object, reply: Reply) => {
    const startedAt = performance.now();
    const controller = new AbortController();
    const timeoutMs = request.timeoutMs ?? DEFAULT_ACTION_TIMEOUT_MS;
    const timer = setTimeout(() => controller.abort(createNativeError(
      "ACTION_TIMEOUT", `Native action timed out after ${timeoutMs} ms.`, true,
    )), timeoutMs);
    let resolveSettled: () => void = () => undefined;
    const settled = new Promise<void>((resolve) => { resolveSettled = resolve; });
    ownerActions(owner).set(request.id, { controller, timer, settled });
    const task = append(() => runWithNativeInputOwner(owner, () => executeNativeWithRetries(request, controller.signal, owner)));
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
      remove(owner, request.id);
      resolveSettled();
    });
  };

  const cancel = async (id: string, reason: string, owner?: object) => {
    const action = owner ? active.get(owner)?.get(id) : entries().find((entry) => entry.id === id)?.action;
    if (!action) return false;
    action.controller.abort(createNativeError("ACTION_CANCELLED", reason));
    return true;
  };
  const cancelPrefix = async (id: string, reason: string, owner?: object) => {
    const matched = entries().filter((entry) =>
      (entry.id === id || entry.id.startsWith(`${id}:`)) && (!owner || entry.owner === owner));
    for (const entry of matched) await cancel(entry.id, reason, entry.owner);
    return matched.map((entry) => entry.id);
  };

  const cancelOwner = async (owner: object, reason: string) => {
    const actions = [...(active.get(owner)?.entries() || [])];
    for (const [id] of actions) await cancel(id, reason, owner);
    await Promise.allSettled(actions.map(([, action]) => action.settled));
    await cancelUploadsByOwner(owner);
    await cancelDownloadsByOwner(owner);
  };

  const disconnectOwner = async (owner: object, reason: string) => {
    await cancelOwner(owner, reason);
    await append(() => releaseNativeInputOwner(owner));
  };

  const close = async () => {
    const current = entries();
    const settlements = current.map(({ action }) => action.settled);
    for (const entry of current) await cancel(entry.id, "The native host is shutting down.", entry.owner);
    await Promise.allSettled(settlements);
    await append(releaseAllNativeInput);
    await cleanupUploads();
    await cleanupDownloads();
  };

  return {
    execute, cancel, cancelPrefix, cancelOwner, disconnectOwner,
    releaseInput: () => append(releaseAllNativeInput), close,
    has: (id: string, owner?: object) => owner ? active.get(owner)?.has(id) === true : entries().some((entry) => entry.id === id),
  };
};
