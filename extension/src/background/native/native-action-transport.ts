import type { ActionRequest, ActionResult } from "../../../../src/types/action.js";
import type { NativeMessage } from "../../../../src/types/relay.js";

type Send = (message: NativeMessage) => void;
type Pending = { resolve: (result: ActionResult) => void; reject: (error: Error) => void; abort: () => void };

export const createNativeActionTransport = (send: Send) => {
  const pending = new Map<string, Pending>();

  const complete = (result: ActionResult) => {
    const action = pending.get(result.id);
    if (!action) return false;
    pending.delete(result.id);
    action.abort();
    action.resolve(result);
    return true;
  };

  const execute = (request: ActionRequest, signal: AbortSignal) => new Promise<ActionResult>((resolve, reject) => {
    if (pending.has(request.id)) return reject(new Error(`Native action id "${request.id}" is already pending.`));
    const cancel = () => {
      if (!pending.delete(request.id)) return;
      try { send({ type: "cancel", id: request.id, reason: String(signal.reason || "Cancelled") }); } catch {}
      reject(signal.reason instanceof Error ? signal.reason : new Error("Native action cancelled."));
    };
    const abort = () => signal.removeEventListener("abort", cancel);
    pending.set(request.id, { resolve, reject, abort });
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) return cancel();
    try {
      send({ type: "actionRequest", request: { ...request, engine: "native" } });
    } catch (error) {
      pending.delete(request.id);
      abort();
      reject(error instanceof Error ? error : new Error("Native action request failed."));
    }
  });

  const close = (message: string) => {
    for (const [id, action] of pending) {
      pending.delete(id);
      action.abort();
      action.reject(new Error(message));
    }
  };

  return { execute, complete, close };
};
