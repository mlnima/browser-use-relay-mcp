import { sendAttachedDebuggerCommand, sendDebuggerCommand } from "./debugger-session";

const active = new Set<number>();
const clearState = (tabId?: number) => tabId !== undefined && active.delete(tabId);
chrome.debugger.onDetach.addListener((source) => clearState(source.tabId));
chrome.webNavigation.onCommitted.addListener((details) => details.frameId === 0 && clearState(details.tabId));

const clearIme = async (tabId: number) => {
  await sendDebuggerCommand(tabId, "Input.imeSetComposition", { text: "", selectionStart: 0, selectionEnd: 0 });
  active.delete(tabId);
};
export const composeImeText = async (tabId: number, text: string, commit: boolean, signal?: AbortSignal) => {
  active.add(tabId);
  try {
    await sendDebuggerCommand(tabId, "Input.imeSetComposition", { text, selectionStart: text.length, selectionEnd: text.length });
    signal?.throwIfAborted();
    if (!commit) return;
    await sendDebuggerCommand(tabId, "Input.insertText", { text });
    signal?.throwIfAborted();
    await clearIme(tabId);
  } catch (error) {
    await clearIme(tabId).catch(() => undefined);
    throw error;
  }
};

export const cancelActiveIme = async () => {
  await Promise.allSettled([...active].map(async (tabId) => {
    await sendAttachedDebuggerCommand(tabId, "Input.imeSetComposition", { text: "", selectionStart: 0, selectionEnd: 0 });
    active.delete(tabId);
  }));
};
