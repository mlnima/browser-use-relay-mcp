import type { BrowserApiHandler } from "./types.js";
import { completed, toJson } from "./json.js";
import { paramsOf } from "./parameters.js";

const downloadId = (request: Parameters<BrowserApiHandler>[0]) => {
  const id = request.params?.downloadId ?? request.params?.id;
  if (typeof id !== "number") throw new Error("A download ID is required.");
  return id;
};

export const handleDownloadAction: BrowserApiHandler = async (request) => {
  const params = paramsOf(request);
  switch (request.action) {
    case "startDownload":
      return await chrome.downloads.download(params as unknown as chrome.downloads.DownloadOptions);
    case "listDownloads":
      return toJson(await chrome.downloads.search((params.query || params) as chrome.downloads.DownloadQuery));
    case "pauseDownload":
      await chrome.downloads.pause(downloadId(request));
      return completed();
    case "resumeDownload":
      await chrome.downloads.resume(downloadId(request));
      return completed();
    case "cancelDownload":
      await chrome.downloads.cancel(downloadId(request));
      return completed();
    case "removeDownloadedFile":
      await chrome.downloads.removeFile(downloadId(request));
      return completed();
    case "eraseDownload": {
      const source = params.query && typeof params.query === "object" && !Array.isArray(params.query) ? params.query as typeof params : params;
      const { all, ...query } = source;
      if (all !== true && !Object.keys(query).length) throw new Error("A download query or explicit params.all=true is required.");
      return toJson(await chrome.downloads.erase((all === true ? {} : query) as chrome.downloads.DownloadQuery));
    }
    default:
      return undefined;
  }
};
