import type { ActionRequest, ActionResult } from "../../../../src/types/action.js";
import type { JsonValue } from "../../../../src/types/json.js";
import { resolveTabId } from "./tab";
import { executeRetryAction } from "./compound-retry";
type Run = (request: ActionRequest, signal: AbortSignal) => Promise<ActionResult>;
const nested = (request: ActionRequest, suffix: string, action: string, input: Partial<ActionRequest> = {}): ActionRequest => ({
  ...request,
  ...input,
  id: `${request.id}:${suffix}`,
  action,
});
const success = async (promise: Promise<ActionResult>) => {
  const result = await promise;
  if (!result.success) throw new Error(result.error?.message || "Compound browser action failed.");
  return result;
};
const objectParam = (value: JsonValue | undefined) => value && typeof value === "object" && !Array.isArray(value)
  ? value as Record<string, JsonValue>
  : undefined;
const waitForNavigation = (tabId: number, timeoutMs: number, signal: AbortSignal) => new Promise<JsonValue>((resolve, reject) => {
  const clean = () => {
    clearTimeout(timer); chrome.webNavigation.onCompleted.removeListener(completed);
    chrome.webNavigation.onErrorOccurred.removeListener(failed); chrome.webNavigation.onHistoryStateUpdated.removeListener(history);
    chrome.webNavigation.onReferenceFragmentUpdated.removeListener(fragment);
    signal.removeEventListener("abort", aborted);
  };
  const finish = (data: JsonValue) => (clean(), resolve(data));
  const completed = (details: chrome.webNavigation.WebNavigationFramedCallbackDetails) => details.tabId === tabId && details.frameId === 0 && finish({ event: "completed", url: details.url }); const failed = (details: chrome.webNavigation.WebNavigationFramedErrorCallbackDetails) => details.tabId === tabId && details.frameId === 0 && finish({ event: "error", url: details.url, error: details.error });
  const history = (details: chrome.webNavigation.WebNavigationFramedCallbackDetails) => details.tabId === tabId && details.frameId === 0 && finish({ event: "historyStateUpdated", url: details.url }); const fragment = (details: chrome.webNavigation.WebNavigationFramedCallbackDetails) => details.tabId === tabId && details.frameId === 0 && finish({ event: "referenceFragmentUpdated", url: details.url });
  const aborted = () => (clean(), reject(signal.reason instanceof Error ? signal.reason : new Error("Action cancelled.")));
  const timer = setTimeout(() => (clean(), reject(new Error("Timed out waiting for submitted navigation."))), timeoutMs);
  chrome.webNavigation.onCompleted.addListener(completed); chrome.webNavigation.onErrorOccurred.addListener(failed);
  chrome.webNavigation.onHistoryStateUpdated.addListener(history);
  chrome.webNavigation.onReferenceFragmentUpdated.addListener(fragment);
  signal.addEventListener("abort", aborted, { once: true }); if (signal.aborted) aborted();
});

export const executeCompoundAction = async (request: ActionRequest, signal: AbortSignal, run: Run): Promise<JsonValue | undefined> => {
  const params = request.params || {};
  if (request.action === "openDownload" || request.action === "revealDownload") {
    let path = typeof params.path === "string" ? params.path : undefined;
    const downloadId = params.downloadId ?? params.id;
    if (!path) {
      if (typeof downloadId !== "number") throw new Error(`${request.action} requires params.path or a completed downloadId.`);
      if (!chrome.downloads?.search) throw new Error("chrome.downloads.search is unavailable in this browser.");
      const [download] = await chrome.downloads.search({ id: downloadId });
      if (!download) throw new Error(`Download ${downloadId} was not found.`);
      if (download.state !== "complete") throw new Error(`Download ${downloadId} is not complete.`);
      if (!download.filename) throw new Error(`Download ${downloadId} has no local filename.`);
      path = download.filename;
    }
    const result = await success(run(nested(request, "native", request.action, { engine: "native", params: { ...params, path } }), signal));
    return { ...(typeof downloadId === "number" && { downloadId }), path, native: result.data ?? null };
  }
  if (request.action === "openAndSwitchToNewTab") {
    const tab = await success(run(nested(request, "open", "newTab", { engine: "browser", params: { ...(objectParam(params.tab) || params), active: true } }), signal));
    return { tab: tab.data ?? null };
  }
  if (request.action === "downloadAndWait") {
    const started = await success(run(nested(request, "start", "startDownload", { engine: "browser", params: objectParam(params.download) || params }), signal));
    if (typeof started.data !== "number") throw new Error("The browser did not return a download ID.");
    const completed = await success(run(nested(request, "wait", "waitDownload", { engine: "browser", params: { ...(objectParam(params.wait) || {}), downloadId: started.data } }), signal));
    return { downloadId: started.data, download: completed.data ?? null };
  }
  if (request.action === "uploadAndWait") {
    const uploaded = await success(run(nested(request, "upload", "setInputFiles", { engine: "browser" }), signal));
    const completed = await success(run(nested(request, "wait", "waitUpload", { engine: "dom", params: objectParam(params.wait) || params }), signal));
    return { upload: uploaded.data ?? null, completion: completed.data ?? null };
  }
  if (request.action === "submitAndWait") {
    const tabId = await resolveTabId(request.target?.tabId);
    const waiter = new AbortController();
    const abort = () => waiter.abort(signal.reason);
    signal.addEventListener("abort", abort, { once: true }); if (signal.aborted) abort();
    const navigation = params.waitFor === "stable" ? undefined : waitForNavigation(tabId, request.timeoutMs ?? 30_000, waiter.signal);
    try {
      const submitted = await success(run(nested(request, "submit", "submitForm", { engine: "browser" }), signal));
      const stable = params.waitFor === "navigation" ? undefined : success(run(nested(request, "stable", "waitStable", { engine: "dom", params: objectParam(params.wait) || {} }), waiter.signal)).then((result) => result.data ?? null);
      const completion = params.waitFor === "navigation" ? await navigation!
        : params.waitFor === "stable" ? await stable!
          : await Promise.any([navigation!, stable!]);
      return { submit: submitted.data ?? null, completion };
    } finally {
      waiter.abort(new Error("Submit wait completed."));
      await navigation?.catch(() => undefined);
      signal.removeEventListener("abort", abort);
    }
  }
  if (request.action === "retryAction") return executeRetryAction(request, signal, run);
  return undefined;
};
