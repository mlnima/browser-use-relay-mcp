import type { BrowserApiHandler } from "./types.js";
import type { ClipboardRequest } from "../../offscreen/clipboard/types.js";
import { ensureCaptureDocument } from "./tab-capture/offscreen-document.js";
import { toJson } from "./json.js";

export const handleClipboardAction: BrowserApiHandler = async (request, signal) => {
  if (request.action !== "readClipboard" && request.action !== "writeClipboard") return undefined;
  await ensureCaptureDocument(signal);
  const message: ClipboardRequest = request.action === "readClipboard"
    ? {
        type: "relay.offscreen.clipboard",
        operation: "read",
        formats: Array.isArray(request.params?.formats) ? request.params.formats.map(String) : undefined,
      }
    : {
        type: "relay.offscreen.clipboard",
        operation: "write",
        text: typeof request.params?.text === "string" ? request.params.text : undefined,
        html: typeof request.params?.html === "string" ? request.params.html : undefined,
        items: request.params?.items as unknown as ClipboardRequest["items"],
      };
  return toJson(await chrome.runtime.sendMessage(message));
};
