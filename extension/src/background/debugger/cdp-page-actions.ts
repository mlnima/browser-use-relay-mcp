import type { ActionRequest } from "../../../../src/types/action.js";
import { MAX_CDP_RESPONSE_BODY_BYTES } from "../../../../src/protocol/limits.js";
import { sendDebuggerCommand } from "./debugger-session";
import { inspectFileInputTarget, resolveFileInputBackendNode } from "./resolve-backend-node";
import { captureFullPage, capturePageElement } from "./page-capture";
import { getCdpRequest } from "./cdp-network-store";

const absolutePath = (value: string) => value.startsWith("/") || value.startsWith("\\\\") || /^[A-Za-z]:[\\/]/.test(value);
type ResponseBody = { body: string; base64Encoded: boolean };
const bodyLimit = (value: unknown) => {
  const limit = value === undefined ? MAX_CDP_RESPONSE_BODY_BYTES : value;
  if (typeof limit !== "number" || !Number.isSafeInteger(limit) || limit < 1 || limit > MAX_CDP_RESPONSE_BODY_BYTES) {
    throw new Error(`maxBodyBytes must be an integer from 1 to ${MAX_CDP_RESPONSE_BODY_BYTES}.`);
  }
  return limit;
};
const validateBody = (result: ResponseBody, limit: number) => {
  if (result.body.length > (result.base64Encoded ? Math.ceil(limit / 3) * 4 : limit)) throw new Error("The response body exceeds the requested byte limit.");
  const bytes = result.base64Encoded
    ? Math.floor(result.body.length * 3 / 4) - (result.body.endsWith("==") ? 2 : result.body.endsWith("=") ? 1 : 0)
    : new TextEncoder().encode(result.body).byteLength;
  if (bytes > limit) throw new Error("The response body exceeds the requested byte limit.");
  return { ...result, bodyBytes: bytes, bodyByteLimit: limit };
};

export const executeCdpPageAction = async (request: ActionRequest, tabId: number, signal?: AbortSignal) => {
  if (request.action === "stopLoading") return (await sendDebuggerCommand(tabId, "Page.stopLoading"), true);
  if (request.action === "hardReload") return (await sendDebuggerCommand(tabId, "Page.reload", { ignoreCache: true }), true);
  if (request.action === "getResponseBody") {
    const requestId = request.params?.requestId;
    if (request.params?.source !== "cdp") throw new Error("getResponseBody requires params.source='cdp' and a CDP request ID.");
    if (typeof requestId !== "string") throw new Error("getResponseBody requires a CDP request ID.");
    const record = getCdpRequest(requestId, tabId);
    if (!record || record.phase !== "completed" || record.bodyAvailable !== true) throw new Error("The CDP request is not completed with an available response body.");
    const limit = bodyLimit(request.params?.maxBodyBytes);
    if (typeof record.encodedBytes === "number" && record.encodedBytes > limit) throw new Error("The encoded response body exceeds the requested byte limit.");
    return validateBody(await sendDebuggerCommand<ResponseBody>(tabId, "Network.getResponseBody", { requestId }), limit);
  }
  if (request.action === "setInputFiles" || request.action === "clearFiles") {
    const supplied = request.params?.files;
    if (request.action === "setInputFiles" && (!Array.isArray(supplied) || supplied.length === 0 ||
      !supplied.every((path) => typeof path === "string" && path.length > 0 && absolutePath(path)))) {
      throw new Error("setInputFiles requires a non-empty params.files array of absolute browser-device paths.");
    }
    const files = request.action === "clearFiles" ? [] : supplied as string[];
    const target = await resolveFileInputBackendNode(request, tabId, signal);
    if (!target.enabled) throw new Error("The target file input is disabled.");
    if (!target.multiple && files.length > 1) throw new Error("The target file input does not accept multiple files.");
    await sendDebuggerCommand(tabId, "DOM.setFileInputFiles", { files, backendNodeId: target.backendNodeId });
    const observed = await inspectFileInputTarget(tabId, target.backendNodeId);
    if (observed.fileCount !== files.length && (!target.directory || observed.fileCount === 0)) throw new Error("The target file input did not retain the requested file count.");
    return { files: observed.fileCount };
  }
  if (request.action === "captureFullPage") return captureFullPage(request, tabId, signal);
  if (request.action === "captureElement") return capturePageElement(request, tabId, signal);
  return undefined;
};
