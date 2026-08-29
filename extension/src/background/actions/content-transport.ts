import type { ActionRequest, ActionResult } from "../../../../src/types/action.js";
import { contentMessage } from "../../shared/content-messages";
import { resolveTabId } from "./tab";
import { injectContentScript } from "./content-injection";

const optionsFor = (request: ActionRequest): chrome.tabs.MessageSendOptions => request.target?.documentId
  ? { documentId: request.target.documentId }
  : { frameId: request.target?.frameId ?? 0 };

const sendAction = (tabId: number, request: ActionRequest, options: chrome.tabs.MessageSendOptions) =>
  chrome.tabs.sendMessage(tabId, { type: contentMessage.action, request }, options) as Promise<ActionResult>;

const deliver = async (tabId: number, request: ActionRequest, options: chrome.tabs.MessageSendOptions, signal?: AbortSignal) => {
  try {
    return await sendAction(tabId, request, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Content messaging failed.";
    if (!/receiving end does not exist|could not establish connection/i.test(message)) throw error;
    await injectContentScript(request, tabId, signal);
    try {
      return await sendAction(tabId, request, options);
    } catch (retryError) {
      const reason = retryError instanceof Error ? retryError.message : "Content messaging failed after injection.";
      throw new Error(`The content engine did not become available after injection: ${reason}`);
    }
  }
};

export const executeContentAction = async (request: ActionRequest, signal?: AbortSignal) => {
  const tabId = await resolveTabId(request.target?.tabId);
  const options = optionsFor(request);
  signal?.throwIfAborted();
  const response = deliver(tabId, request, options, signal);
  if (!signal) return response;
  return new Promise<ActionResult>((resolve, reject) => {
    let settled = false;
    const abort = () => {
      if (settled) return;
      settled = true;
      void chrome.tabs.sendMessage(tabId, { type: contentMessage.cancel, id: request.id, reason: String(signal.reason || "Action cancelled.") }, options).catch(() => undefined);
      reject(signal.reason || new Error("Action cancelled."));
    };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    response.then((value) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", abort);
      resolve(value);
    }, (error: unknown) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", abort);
      reject(error);
    });
  });
};

export const cancelContentAction = async (request: ActionRequest, reason?: string) => {
  const tabId = await resolveTabId(request.target?.tabId);
  await chrome.tabs.sendMessage(tabId, { type: contentMessage.cancel, id: request.id, reason }, optionsFor(request));
};
