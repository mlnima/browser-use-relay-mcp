import type { ActionRequest } from "../../../../src/types/action.js";

const injectionTarget = (request: ActionRequest, tabId: number): chrome.scripting.InjectionTarget => request.target?.documentId
  ? { tabId, documentIds: [request.target.documentId] }
  : { tabId, frameIds: [request.target?.frameId ?? 0] };

export const injectContentScript = async (request: ActionRequest, tabId: number, signal?: AbortSignal) => {
  signal?.throwIfAborted();
  if (!chrome.scripting?.executeScript) throw new Error("The browser scripting API required for content recovery is unavailable.");
  try {
    await chrome.scripting.executeScript({ target: injectionTarget(request, tabId), files: ["content.js"] });
  } catch (error) {
    const tab = await chrome.tabs.get(tabId).catch(() => undefined);
    const location = tab?.url || tab?.pendingUrl || `tab ${tabId}`;
    const reason = error instanceof Error ? error.message : "Content script injection was rejected.";
    throw new Error(`The content engine is unavailable on ${location}: ${reason}`);
  }
  signal?.throwIfAborted();
};
