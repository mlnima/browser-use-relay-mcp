import {
  getRevision,
  subscribeRevision,
  type ObservationChange,
} from "./revision.js";

const currentChange = (): ObservationChange => ({
  revision: getRevision(),
  reasons: [],
  url: location.href,
});

export const waitForRevision = (
  sinceRevision: number,
  timeoutMs: number,
  signal: AbortSignal,
): Promise<ObservationChange> => {
  if (getRevision() > sinceRevision) return Promise.resolve(currentChange());
  return new Promise((resolve, reject) => {
    let settled = false;
    let unsubscribe: () => void = () => undefined;
    const cleanup = () => {
      unsubscribe();
      window.clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
    };
    const finish = (change: ObservationChange) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(change);
    };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const onAbort = () => fail(signal.reason || new Error("Page observation was cancelled."));
    const timer = window.setTimeout(() => fail(new Error(`Page observation timed out after ${timeoutMs} ms.`)), timeoutMs);
    unsubscribe = subscribeRevision((change) => change.revision > sinceRevision && finish(change));
    signal.addEventListener("abort", onAbort, { once: true });
    signal.aborted ? onAbort() : getRevision() > sinceRevision && finish(currentChange());
  });
};
