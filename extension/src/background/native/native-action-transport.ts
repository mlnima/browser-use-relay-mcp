import type { ActionRequest, ActionResult, NativePage } from "../../../../src/types/action.js";
import type { NativeMessage } from "../../../../src/types/relay.js";
import { prepareNativePage, watchNativePage } from "./native-page";

type Send = (message: NativeMessage) => void;
type Pending = { resolve: (result: ActionResult) => void; reject: (error: Error) => void; abort: (keepWatch?: boolean) => void;
  page?: NativePage; stop: () => void };

export const createNativeActionTransport = (send: Send) => {
  const pending = new Map<string, Pending>();
  const held = new Map<string, { page: NativePage; stop: () => void }>();
  const invalidate = (page: NativePage, reason: string) => {
    held.get(page.observation)?.stop(); held.delete(page.observation);
    try { send({ type: "pageInvalidated", observation: page.observation, reason }); } catch {}
  };

  const complete = (result: ActionResult, inputHeld = false) => {
    const action = pending.get(result.id);
    if (!action) return false;
    pending.delete(result.id);
    const page = action.page;
    if (page) {
      held.get(page.observation)?.stop(); held.delete(page.observation);
      if (inputHeld) held.set(page.observation, { page, stop: action.stop });
    }
    action.abort(inputHeld);
    action.resolve(result);
    return true;
  };

  const execute = async (request: ActionRequest, signal: AbortSignal) => {
    let prepared: Awaited<ReturnType<typeof prepareNativePage>>;
    try { prepared = await prepareNativePage(request, signal); }
    catch (error) {
      for (const { page } of held.values()) invalidate(page, "Native page preparation failed; held input was released.");
      throw error;
    }
    return new Promise<ActionResult>((resolve, reject) => {
      if (pending.has(request.id)) return reject(new Error(`Native action id "${request.id}" is already pending.`));
      const cancel = (error?: unknown) => {
        if (!pending.delete(request.id)) return;
        abort();
        const reason = error instanceof Error ? error : signal.reason instanceof Error ? signal.reason : new Error("Native action cancelled.");
        prepared.page && invalidate(prepared.page, reason.message);
        try { send({ type: "cancel", id: request.id, reason: reason.message }); } catch {}
        reject(reason);
      };
      const stop = prepared.page ? watchNativePage(prepared.page, () => {
        const reason = "The webpage moved, resized, zoomed, or lost focus. Native input was stopped.";
        stop(); invalidate(prepared.page!, reason); cancel(new Error(reason));
      }) : () => undefined;
      const abort = (keepWatch = false) => { signal.removeEventListener("abort", cancel); !keepWatch && stop(); };
      pending.set(request.id, { resolve, reject, abort, page: prepared.page, stop });
      signal.addEventListener("abort", cancel, { once: true });
      if (signal.aborted) return cancel();
      try {
        send({ type: "actionRequest", request: { ...prepared.request, engine: "native" }, page: prepared.page });
      } catch (error) { cancel(error); }
    });
  };

  const close = (message: string) => {
    for (const { page } of held.values()) invalidate(page, message);
    for (const [id, action] of pending) {
      pending.delete(id);
      action.abort();
      action.reject(new Error(message));
    }
  };

  return { execute, complete, close };
};
