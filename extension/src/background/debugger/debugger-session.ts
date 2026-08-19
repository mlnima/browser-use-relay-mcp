import { getState } from "../state/state-store";
import { executionError } from "../actions/execution-error.js";

const attachedTabs = new Set<number>();
const attachingTabs = new Map<number, Promise<void>>();
const inputTails = new Map<number, Promise<void>>();

chrome.debugger.onDetach.addListener((source) => source.tabId !== undefined && attachedTabs.delete(source.tabId));

export const ensureDebugger = async (tabId: number) => {
  if (!getState().settings.enabled) throw new Error("Browser control is disabled in the extension.");
  if (attachedTabs.has(tabId)) return;
  const pending = attachingTabs.get(tabId);
  if (pending) return pending;
  const attach = (async () => {
    try {
      await chrome.debugger.attach({ tabId }, "1.3");
      await chrome.debugger.sendCommand({ tabId }, "Page.enable");
      await chrome.debugger.sendCommand({ tabId }, "Runtime.enable");
      await chrome.debugger.sendCommand({ tabId }, "DOM.enable");
      await chrome.debugger.sendCommand({ tabId }, "Network.enable", { maxTotalBufferSize: 100_000_000, maxResourceBufferSize: 20_000_000 });
      if (!getState().settings.enabled) throw new Error("Browser control was disabled while attaching the debugger.");
      attachedTabs.add(tabId);
    } catch (error) {
      attachedTabs.delete(tabId);
      await chrome.debugger.detach({ tabId }).catch(() => undefined);
      throw executionError(error instanceof Error ? error.message : "Unable to attach the debugger.", true);
    }
  })()
    .finally(() => attachingTabs.delete(tabId));
  attachingTabs.set(tabId, attach);
  return attach;
};

export const sendDebuggerCommand = async <T = unknown>(tabId: number, method: string, params: Record<string, unknown> = {}) => {
  await ensureDebugger(tabId);
  return sendAttachedDebuggerCommand<T>(tabId, method, params);
};

export const sendAttachedDebuggerCommand = <T = unknown>(tabId: number, method: string, params: Record<string, unknown> = {}) =>
  chrome.debugger.sendCommand({ tabId }, method, params) as unknown as Promise<T>;

const waitForInputTurn = (pending: Promise<void>, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  let settled = false;
  const finish = (callback: () => void) => {
    if (settled) return;
    settled = true; signal?.removeEventListener("abort", abort); callback();
  };
  const abort = () => finish(() => reject(signal?.reason instanceof Error ? signal.reason : new Error("Input action cancelled.")));
  pending.then(() => finish(resolve), () => finish(resolve));
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
});

export const runSerializedInput = async <T>(tabId: number, signal: AbortSignal | undefined, run: () => Promise<T>) => {
  const previous = inputTails.get(tabId) || Promise.resolve();
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const tail = previous.catch(() => undefined).then(() => gate);
  inputTails.set(tabId, tail);
  try {
    await waitForInputTurn(previous, signal);
    signal?.throwIfAborted();
    return await run();
  } finally {
    release();
    void tail.finally(() => { if (inputTails.get(tabId) === tail) inputTails.delete(tabId); });
  }
};

export const drainSerializedInput = async () => {
  while (inputTails.size) await Promise.allSettled([...inputTails.values()]);
};

export const detachDebugger = async (tabId: number) => {
  await attachingTabs.get(tabId)?.catch(() => undefined);
  if (!attachedTabs.has(tabId)) return;
  attachedTabs.delete(tabId);
  await chrome.debugger.detach({ tabId }).catch(() => undefined);
};

export const detachAllDebuggers = async () => {
  await Promise.allSettled([...attachingTabs.values()]);
  return Promise.all([...attachedTabs].map(detachDebugger));
};
