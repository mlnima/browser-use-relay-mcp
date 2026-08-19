import type { NativeMessage } from "../../../../src/types/relay.js";
import { contentMessage } from "../../shared/content-messages";
import { registerBrowserEvents } from "./register-browser-events";
import { createEventForwardingQueue } from "./event-forwarding-queue";

type Send = (message: NativeMessage) => void;

export const registerEventForwarding = (enabled: () => boolean, send: Send) => {
  const enqueue = createEventForwardingQueue(enabled, send);
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (message?.type !== contentMessage.changed || !enabled()) return undefined;
    enqueue({
      type: "event",
      name: message.error ? "page.error" : "page.changed",
      data: {
        ...message,
        tabId: sender.tab?.id ?? null,
        frameId: sender.frameId ?? null,
        documentId: sender.documentId ?? null,
      },
    });
    return undefined;
  });
  registerBrowserEvents((name, data) => {
    if (enabled()) enqueue({ type: "event", name, data });
  });
};
