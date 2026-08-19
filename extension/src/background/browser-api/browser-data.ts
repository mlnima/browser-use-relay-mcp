import type { BrowserApiHandler } from "./types.js";
import { completed, toJson } from "./json.js";
import { paramsOf } from "./parameters.js";

const deleteHistory = async (params: ReturnType<typeof paramsOf>) => {
  if (typeof params.url === "string") await chrome.history.deleteUrl({ url: params.url });
  else if (typeof params.startTime === "number" && typeof params.endTime === "number") {
    await chrome.history.deleteRange({ startTime: params.startTime, endTime: params.endTime });
  } else if (params.all === true) await chrome.history.deleteAll();
  else throw new Error("deleteHistory requires params.url, startTime/endTime, or explicit all:true.");
  return completed();
};

const listBookmarks = async (params: ReturnType<typeof paramsOf>) => {
  if (params.query) return chrome.bookmarks.search(params.query as string | chrome.bookmarks.SearchQuery);
  if (typeof params.parentId === "string") return chrome.bookmarks.getChildren(params.parentId);
  if (typeof params.id === "string") return chrome.bookmarks.getSubTree(params.id);
  return chrome.bookmarks.getTree();
};

export const handleBrowserDataAction: BrowserApiHandler = async (request) => {
  const params = paramsOf(request);
  switch (request.action) {
    case "queryHistory":
      return toJson(await chrome.history.search(params as unknown as chrome.history.HistoryQuery));
    case "deleteHistory":
      return deleteHistory(params);
    case "listBookmarks":
      return toJson(await listBookmarks(params));
    case "createBookmark":
      return toJson(await chrome.bookmarks.create(params as chrome.bookmarks.CreateDetails));
    case "updateBookmark":
      return toJson(await chrome.bookmarks.update(params.id as string, (params.changes || params) as chrome.bookmarks.UpdateChanges));
    case "deleteBookmark":
      if (params.recursive === true) await chrome.bookmarks.removeTree(params.id as string);
      else await chrome.bookmarks.remove(params.id as string);
      return completed();
    case "listSessions":
      return toJson(await chrome.sessions.getRecentlyClosed({
        ...(typeof params.maxResults === "number" && { maxResults: params.maxResults }),
      }));
    case "restoreSession":
      return toJson(await chrome.sessions.restore(typeof params.sessionId === "string" ? params.sessionId : undefined));
    default:
      return undefined;
  }
};
