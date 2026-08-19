import type { BrowserApiHandler } from "./types.js";
import { DEFAULT_CONTENT_STORAGE_ENTRIES, MAX_CONTENT_STORAGE_ENTRIES, MAX_CONTENT_VALUE_BYTES } from "../../../../src/protocol/limits.js";
import { toJson } from "./json.js";
import { paramsOf, resolveTabId } from "./parameters.js";
import { inspectIndexedDb } from "./indexeddb-reader.js";

export const handleSiteStorageAction: BrowserApiHandler = async (request) => {
  if (request.action !== "inspectIndexedDB") return undefined;
  const frameId = request.target?.frameId ?? request.params?.frameId;
  const tabId = await resolveTabId(request);
  return toJson(await chrome.scripting.executeScript({
    target: request.target?.documentId
      ? { tabId, documentIds: [request.target.documentId] }
      : { tabId, frameIds: [typeof frameId === "number" ? frameId : 0] },
    world: "ISOLATED",
    func: inspectIndexedDb,
    args: [{ ...paramsOf(request), __relayMaxBytes: MAX_CONTENT_VALUE_BYTES, __relayMaxRows: MAX_CONTENT_STORAGE_ENTRIES, __relayMaxMetadataItems: DEFAULT_CONTENT_STORAGE_ENTRIES }],
  }));
};
