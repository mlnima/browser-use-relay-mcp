import type { ContentActionHandler } from "./types.js";
import { requireHtmlElement } from "./element.js";

const behavior = (value: unknown): ScrollBehavior => value === "smooth" ? "smooth" : "instant";
const waitForStablePosition = (read: () => number[], signal: AbortSignal, minimumChecks: number) => new Promise<void>((resolve, reject) => {
  let previous = "";
  let stableChecks = 0;
  let checks = 0;
  const check = () => {
    if (signal.aborted) {
      reject(signal.reason instanceof Error ? signal.reason : new Error("Action cancelled."));
      return;
    }
    let current = "";
    try {
      current = read().map((value) => Math.round(value * 100) / 100).join(":");
    } catch (error) {
      reject(error);
      return;
    }
    stableChecks = current === previous ? stableChecks + 1 : 0;
    previous = current;
    checks += 1;
    if (stableChecks >= 2 && checks >= minimumChecks) {
      resolve();
      return;
    }
    if (checks >= 120) {
      reject(new Error("Scrolling timed out before it stabilized."));
      return;
    }
    window.setTimeout(check, 16);
  };
  check();
});

export const scrollActionHandlers: Record<string, ContentActionHandler> = {
  scrollTo: async ({ request, signal }) => {
    const requestedBehavior = behavior(request.params?.behavior);
    window.scrollTo({ left: Number(request.params?.x ?? 0), top: Number(request.params?.y ?? 0), behavior: requestedBehavior });
    await waitForStablePosition(() => [scrollX, scrollY], signal, requestedBehavior === "smooth" ? 8 : 3);
    return { x: scrollX, y: scrollY };
  },
  scrollToTop: async ({ request, signal }) => {
    const requestedBehavior = behavior(request.params?.behavior);
    window.scrollTo({ top: 0, behavior: requestedBehavior });
    await waitForStablePosition(() => [scrollX, scrollY], signal, requestedBehavior === "smooth" ? 8 : 3);
    return true;
  },
  scrollToBottom: async ({ request, signal }) => {
    const requestedBehavior = behavior(request.params?.behavior);
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: requestedBehavior });
    await waitForStablePosition(() => [scrollX, scrollY], signal, requestedBehavior === "smooth" ? 8 : 3);
    return true;
  },
  scrollIntoView: async ({ target, request, signal }) => {
    const element = requireHtmlElement(target);
    const requestedBehavior = behavior(request.params?.behavior);
    element.scrollIntoView({ behavior: requestedBehavior, block: "center", inline: "center" });
    await waitForStablePosition(() => {
      if (!element.isConnected) throw new Error("The target element detached while scrolling into view.");
      const bounds = element.getBoundingClientRect();
      return [bounds.x, bounds.y, bounds.width, bounds.height];
    }, signal, requestedBehavior === "smooth" ? 8 : 3);
    return true;
  },
  scrollElement: async ({ target, request, signal }) => {
    const element = requireHtmlElement(target);
    const requestedBehavior = behavior(request.params?.behavior);
    element.scrollBy({ left: Number(request.params?.x ?? 0), top: Number(request.params?.y ?? 0), behavior: requestedBehavior });
    await waitForStablePosition(() => [element.scrollLeft, element.scrollTop], signal, requestedBehavior === "smooth" ? 8 : 3);
    return { x: element.scrollLeft, y: element.scrollTop };
  },
};
