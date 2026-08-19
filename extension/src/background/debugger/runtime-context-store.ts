import { abortableDelay } from "./abortable-delay";

const contexts = new Map<string, number>();
const keyFor = (tabId: number, frameId: string) => `${tabId}:${frameId}`;
const clearTab = (tabId: number) => {
  for (const key of [...contexts.keys()]) if (key.startsWith(`${tabId}:`)) contexts.delete(key);
};

chrome.debugger.onEvent.addListener((source, method, raw) => {
  if (source.tabId === undefined || !raw) return;
  const params = raw as Record<string, unknown>;
  if (method === "Runtime.executionContextCreated") {
    const context = params.context as Record<string, unknown> | undefined;
    const auxiliary = context?.auxData as Record<string, unknown> | undefined;
    if (typeof context?.id === "number" && typeof auxiliary?.frameId === "string" && auxiliary.isDefault === true) {
      contexts.set(keyFor(source.tabId, auxiliary.frameId), context.id);
    }
  }
  if (method === "Runtime.executionContextsCleared") clearTab(source.tabId);
});

chrome.debugger.onDetach.addListener((source) => source.tabId !== undefined && clearTab(source.tabId));
chrome.webNavigation.onCommitted.addListener((details) => details.frameId === 0 && clearTab(details.tabId));

export const waitForMainContext = async (tabId: number, frameId: string, signal?: AbortSignal) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const context = contexts.get(keyFor(tabId, frameId));
    if (context !== undefined) return context;
    await abortableDelay(25, signal);
  }
  throw new Error("The requested frame main-world context is unavailable.");
};
