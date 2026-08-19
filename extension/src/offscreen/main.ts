import type { CaptureMessage } from "../background/browser-api/tab-capture/types.js";
import { handleCaptureMessage } from "./capture/handle-capture-message.js";
import type { ClipboardRequest } from "./clipboard/types.js";
import { handleClipboardMessage } from "./clipboard/handle-clipboard.js";

type OffscreenRequest = { type: "relay.offscreen"; operation: string; text?: string; html?: string };
type Request = OffscreenRequest | CaptureMessage | ClipboardRequest;

const handle = async (request: Request) => {
  if (request?.type === "relay.offscreen.capture") return handleCaptureMessage(request);
  if (request?.type === "relay.offscreen.clipboard") return handleClipboardMessage(request);
  if (request?.type !== "relay.offscreen") return undefined;
  if (request.operation === "readText") return navigator.clipboard.readText();
  if (request.operation === "writeText") return (await navigator.clipboard.writeText(request.text || ""), true);
  if (request.operation === "writeHtml") {
    const item = new ClipboardItem({ "text/html": new Blob([request.html || ""], { type: "text/html" }) });
    await navigator.clipboard.write([item]);
    return true;
  }
  throw new Error(`Unknown offscreen operation: ${request.operation}`);
};

chrome.runtime.onMessage.addListener((request: Request) => handle(request));
