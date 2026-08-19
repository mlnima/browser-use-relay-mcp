import type { JsonValue } from "../../../../src/types/json.js";
import { MAX_CONTENT_VALUE_BYTES, MAX_SNAPSHOT_ATTRIBUTES, MAX_SNAPSHOT_SELECTED_VALUES, MAX_SNAPSHOT_STRING_CHARACTERS } from "../../../../src/protocol/limits.js";
import type { ContentActionContext } from "./types.js";
import { timerParameter } from "./timer-parameter.js";
import { createSnapshotStringLimiter } from "../../shared/snapshot-limit.js";
import { assertTextReadBounded, collectBoundedElementText } from "../catalog/text.js";

const delay = (milliseconds: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const onAbort = () => (window.clearTimeout(timer), reject(signal.reason));
  const timer = window.setTimeout(() => (signal.removeEventListener("abort", onAbort), resolve()), milliseconds);
  signal.addEventListener("abort", onAbort, { once: true });
  if (signal.aborted) onAbort();
});

const fileCount = (element: Element): number =>
  element instanceof HTMLInputElement && element.type === "file" ? element.files?.length || 0 : 0;

const explicitCompletion = (element: Element, params?: Record<string, JsonValue>): boolean | undefined => {
  const checks: boolean[] = [];
  if (typeof params?.completionAttribute === "string") {
    const actual = element.getAttribute(params.completionAttribute);
    checks.push(params.completionValue === undefined ? actual !== null : actual === String(params.completionValue));
  }
  assertTextReadBounded(element, MAX_CONTENT_VALUE_BYTES, "Upload completion text");
  const text = element instanceof HTMLElement ? element.innerText : element.textContent || "";
  typeof params?.completionText === "string" && checks.push(text.includes(params.completionText));
  typeof params?.expectedFileCount === "number" && checks.push(fileCount(element) >= params.expectedFileCount);
  return checks.length ? checks.every(Boolean) : undefined;
};

const conventionalCompletion = (element: Element): boolean => {
  if (element.getAttribute("data-upload-complete") === "true" || element.getAttribute("aria-busy") === "false") return true;
  if (element instanceof HTMLProgressElement) return element.max > 0 && element.value >= element.max;
  return false;
};

const targetSignature = (element: Element): string => {
  const limiter = createSnapshotStringLimiter();
  const attributeCount = Math.min(element.attributes.length, MAX_SNAPSHOT_ATTRIBUTES);
  const attributes: string[][] = [];
  for (let index = 0; index < attributeCount; index += 1) {
    const attribute = element.attributes.item(index)!;
    attributes.push([limiter.limit(attribute.name)!, limiter.limit(attribute.value)!]);
  }
  const sourceFiles = element instanceof HTMLInputElement && element.type === "file" ? element.files : undefined;
  const fileCount = Math.min(sourceFiles?.length || 0, MAX_SNAPSHOT_SELECTED_VALUES);
  const files = Array.from({ length: fileCount }, (_, index) => {
    const file = sourceFiles!.item(index)!;
    return { name: limiter.limit(file.name), size: file.size, type: limiter.limit(file.type), lastModified: file.lastModified };
  });
  const text = collectBoundedElementText(element, MAX_SNAPSHOT_STRING_CHARACTERS + 1);
  return JSON.stringify({
    attributes, attributeTotal: element.attributes.length, text: limiter.limit(text.value),
    value: element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? limiter.limit(element.value) : undefined,
    files, fileTotal: sourceFiles?.length, progress: element instanceof HTMLProgressElement ? { value: element.value, max: element.max } : undefined,
    stringTruncations: limiter.stats.truncatedStrings + Number(text.truncated && (text.value?.length || 0) <= MAX_SNAPSHOT_STRING_CHARACTERS),
  });
};

export const waitForUploadCompletion = async (context: ContentActionContext): Promise<boolean> => {
  const timeoutMs = context.request.timeoutMs ?? 30_000;
  const intervalMs = timerParameter(context.request.params?.pollIntervalMs, 100, 1);
  const requestedStableMs = context.request.params?.stableMs;
  const stableMs = requestedStableMs === undefined ? undefined : timerParameter(requestedStableMs, 0, 1);
  const started = performance.now();
  let tracked: Element | undefined;
  let signature = "";
  let stableSince = started;
  while (performance.now() - started < timeoutMs) {
    context.signal.throwIfAborted();
    const element = context.resolveTarget();
    if (element) {
      const nextSignature = targetSignature(element);
      if (element !== tracked || nextSignature !== signature) {
        tracked = element;
        signature = nextSignature;
        stableSince = performance.now();
      }
      const explicit = explicitCompletion(element, context.request.params);
      if (explicit ?? conventionalCompletion(element)) return true;
      if (stableMs !== undefined && performance.now() - stableSince >= stableMs) return true;
    }
    await delay(intervalMs, context.signal);
  }
  throw new Error(`Upload wait timed out after ${timeoutMs} ms.`);
};
