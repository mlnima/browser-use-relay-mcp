import type { ContentActionHandler } from "./types.js";
import { requireHtmlElement } from "./element.js";

const behavior = (value: unknown): ScrollBehavior => value === "instant" ? "instant" : "smooth";

export const scrollActionHandlers: Record<string, ContentActionHandler> = {
  scrollTo: async ({ request }) => {
    window.scrollTo({ left: Number(request.params?.x ?? 0), top: Number(request.params?.y ?? 0), behavior: behavior(request.params?.behavior) });
    return { x: scrollX, y: scrollY };
  },
  scrollToTop: async ({ request }) => {
    window.scrollTo({ top: 0, behavior: behavior(request.params?.behavior) });
    return true;
  },
  scrollToBottom: async ({ request }) => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: behavior(request.params?.behavior) });
    return true;
  },
  scrollIntoView: async ({ target, request }) => {
    requireHtmlElement(target).scrollIntoView({ behavior: behavior(request.params?.behavior), block: "center", inline: "center" });
    return true;
  },
  scrollElement: async ({ target, request }) => {
    const element = requireHtmlElement(target);
    element.scrollBy({ left: Number(request.params?.x ?? 0), top: Number(request.params?.y ?? 0), behavior: behavior(request.params?.behavior) });
    return { x: element.scrollLeft, y: element.scrollTop };
  },
};
