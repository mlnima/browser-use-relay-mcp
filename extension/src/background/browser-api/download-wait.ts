import type { JsonValue } from "../../../../src/types/json.js";
import type { BrowserApiHandler } from "./types.js";
import { paramsOf } from "./parameters.js";
import { toJson } from "./json.js";
import { abortReason, listenForAbort } from "./wait-signal.js";

const matches = (item: chrome.downloads.DownloadItem, params: Record<string, JsonValue>) =>
  (typeof params.downloadId !== "number" || item.id === params.downloadId)
  && (typeof params.state !== "string" || item.state === params.state)
  && (typeof params.filenameContains !== "string" || item.filename.includes(params.filenameContains))
  && (typeof params.urlContains !== "string" || item.url.includes(params.urlContains));

export const handleDownloadWaitAction: BrowserApiHandler = async (request, signal) => {
  if (request.action !== "waitDownload") return undefined;
  const params = paramsOf(request);
  const expected = typeof params.state === "string" ? params : { ...params, state: "complete" };
  return new Promise<JsonValue>((resolve, reject) => {
    let settled = false;
    let removeAbort: () => void = () => undefined;
    const clean = () => {
      chrome.downloads.onChanged.removeListener(listener);
      clearTimeout(timer);
      removeAbort();
    };
    const finish = (item: chrome.downloads.DownloadItem) => {
      if (settled) return;
      settled = true;
      clean();
      resolve(toJson(item));
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      clean();
      reject(error);
    };
    const check = async (id: number) => {
      const [item] = await chrome.downloads.search({ id });
      if (item && matches(item, expected)) finish(item);
    };
    const listener = (delta: chrome.downloads.DownloadDelta) => {
      void check(delta.id).catch((error: unknown) => fail(error instanceof Error ? error : new Error("Unable to inspect downloads.")));
    };
    chrome.downloads.onChanged.addListener(listener);
    const timeout = request.timeoutMs ?? 30_000;
    const timer = setTimeout(() => fail(new Error("Timed out waiting for a download.")), timeout);
    removeAbort = listenForAbort(signal, () => fail(abortReason(signal)));
    void chrome.downloads.search({
      ...(typeof expected.downloadId === "number" && { id: expected.downloadId }),
    }).then((items) => {
      const found = items.find((item) => matches(item, expected));
      if (found) finish(found);
    }).catch((error: unknown) => fail(error instanceof Error ? error : new Error("Unable to inspect downloads.")));
  });
};
