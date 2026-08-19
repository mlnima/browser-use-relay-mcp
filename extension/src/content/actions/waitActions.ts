import type { ContentActionHandler, ContentActionContext } from "./types.js";
import { MAX_CONTENT_VALUE_BYTES } from "../../../../src/protocol/limits.js";
import { getRevision } from "../observation/revision";
import { assertTextReadBounded } from "../catalog/text.js";
import { waitForUploadCompletion } from "./upload-wait";
import { timerParameter } from "./timer-parameter";

const delay = (milliseconds: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  let settled = false;
  const finish = (callback: () => void) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
    callback();
  };
  const abort = () => finish(() => reject(signal.reason instanceof Error ? signal.reason : new Error("Wait cancelled.")));
  const timer = setTimeout(() => finish(resolve), milliseconds);
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
});

const until = async (context: ContentActionContext, predicate: () => boolean) => {
  const timeout = context.request.timeoutMs ?? 30_000;
  const interval = timerParameter(context.request.params?.pollIntervalMs, 100, 1);
  const started = performance.now();
  while (!predicate()) {
    context.signal.throwIfAborted();
    if (performance.now() - started >= timeout) throw new Error(`Wait timed out after ${timeout} ms.`);
    await delay(interval, context.signal);
  }
  return true;
};

const visible = (element?: Element) => {
  if (!element?.isConnected) return false;
  const bounds = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return bounds.width > 0 && bounds.height > 0 && style.visibility !== "hidden" && style.display !== "none";
};

const enabled = (element?: Element) => Boolean(element?.isConnected && !element.matches(":disabled,[aria-disabled='true']"));
const hasText = (element: Element | undefined, expected: string) => {
  if (!element) return false;
  assertTextReadBounded(element, MAX_CONTENT_VALUE_BYTES, "waitText source");
  return (element.textContent || "").includes(expected);
};

export const waitActionHandlers: Record<string, ContentActionHandler> = {
  sleep: async ({ request, signal }) => (await delay(timerParameter(request.params?.durationMs, 0, 0), signal), true),
  waitForElement: async (context) => until(context, () => Boolean(context.resolveTarget()?.isConnected)),
  waitForElementRemoved: async (context) => until(context, () => !context.resolveTarget()?.isConnected),
  waitVisible: async (context) => until(context, () => visible(context.resolveTarget())),
  waitHidden: async (context) => until(context, () => !visible(context.resolveTarget())),
  waitEnabled: async (context) => until(context, () => enabled(context.resolveTarget())),
  waitDisabled: async (context) => until(context, () => !enabled(context.resolveTarget())),
  waitText: async (context) => until(context, () => hasText(context.resolveTarget(), String(context.request.params?.text ?? ""))),
  waitValue: async (context) => until(context, () => "value" in (context.resolveTarget() || {}) && String((context.resolveTarget() as HTMLInputElement).value) === String(context.request.params?.value ?? "")),
  waitAttribute: async (context) => until(context, () => context.resolveTarget()?.getAttribute(String(context.request.params?.name ?? "")) === String(context.request.params?.value ?? "")),
  waitDOMMutation: async (context) => {
    const revision = getRevision();
    return until(context, () => getRevision() !== revision);
  },
  waitStable: async (context) => {
    const stableMs = timerParameter(context.request.params?.stableMs, 500, 1);
    const started = performance.now();
    let revision = getRevision();
    let changedAt = started;
    while (performance.now() - changedAt < stableMs) {
      context.signal.throwIfAborted();
      if (getRevision() !== revision) (revision = getRevision(), changedAt = performance.now());
      if (performance.now() - started >= (context.request.timeoutMs ?? 30_000)) throw new Error("Page stability wait timed out.");
      await delay(50, context.signal);
    }
    return { revision, stableMs };
  },
  waitUpload: waitForUploadCompletion,
};
