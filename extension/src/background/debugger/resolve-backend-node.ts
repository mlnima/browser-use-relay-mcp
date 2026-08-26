import type { ActionRequest } from "../../../../src/types/action.js";
import { resolveBrowserFrameId } from "./frame-coordinates";
import { resolveCdpFrame } from "./resolve-cdp-frame";
import { resolveElementPath, resolvePoint, type ElementPathStep } from "./resolve-point";
import { waitForMainContext } from "./runtime-context-store";
import { sendDebuggerCommand } from "./debugger-session";

type RemoteObject = { objectId?: string; value?: unknown };
type EvaluateResult = { result: RemoteObject; exceptionDetails?: unknown };
type ResolvedNode = { object?: RemoteObject };
type NodeDescription = { backendNodeId: number; nodeName: string; attributes?: string[] };
type DescribedNode = { node: NodeDescription };
type LocatedNode = { backendNodeId: number };
export type FileInputTarget = { backendNodeId: number; enabled: boolean; multiple: boolean; directory: boolean; fileCount: number; fileBytes: number };

const pathExpression = (path: ElementPathStep[]) => `(()=>{const path=${JSON.stringify(path)};let node;for(const step of path){if(step.scope==="document")node=document.children[step.index];else if(step.scope==="children")node=node?.children[step.index];else node=node?.shadowRoot?.children[step.index];if(!node)return null;}return node;})()`;

const nodeFromPath = async (request: ActionRequest, tabId: number, signal?: AbortSignal) => {
  const path = await resolveElementPath(request, signal);
  const browserFrameId = await resolveBrowserFrameId(request, tabId);
  const cdpFrameId = await resolveCdpFrame(tabId, browserFrameId);
  const contextId = await waitForMainContext(tabId, cdpFrameId, signal);
  const located = await sendDebuggerCommand<EvaluateResult>(tabId, "Runtime.evaluate", {
    expression: pathExpression(path),
    contextId,
    returnByValue: false,
    throwOnSideEffect: true,
  });
  const objectId = located.result.objectId;
  if (located.exceptionDetails || !objectId) throw new Error("Unable to resolve the exact file input target.");
  try {
    return (await sendDebuggerCommand<DescribedNode>(tabId, "DOM.describeNode", { objectId })).node;
  } finally {
    await sendDebuggerCommand(tabId, "Runtime.releaseObject", { objectId }).catch(() => undefined);
  }
};

const nodeFromPoint = async (request: ActionRequest, tabId: number, signal?: AbortSignal) => {
  const point = await resolvePoint(request, tabId, signal);
  const located = await sendDebuggerCommand<LocatedNode>(tabId, "DOM.getNodeForLocation", point);
  return (await sendDebuggerCommand<DescribedNode>(tabId, "DOM.describeNode", {
    backendNodeId: located.backendNodeId,
  })).node;
};
export const inspectFileInputTarget = async (tabId: number, backendNodeId: number) => {
  const resolved = await sendDebuggerCommand<ResolvedNode>(tabId, "DOM.resolveNode", { backendNodeId });
  const objectId = resolved.object?.objectId;
  if (!objectId) throw new Error("Unable to inspect the resolved file input target.");
  try {
    const inspected = await sendDebuggerCommand<EvaluateResult>(tabId, "Runtime.callFunctionOn", {
      objectId, arguments: [{ objectId }], returnByValue: true,
      functionDeclaration: `(element) => { let current = element; let enabled = true; while (current) { if (current.matches?.('[inert],[aria-disabled="true"]')) { enabled = false; break; } current = current.parentElement || current.getRootNode?.().host; } const files = Array.from(element.files || []); return { enabled: enabled && !element.matches(':disabled'), multiple: element.multiple, directory: element.webkitdirectory, fileCount: files.length, fileBytes: files.reduce((total, file) => total + file.size, 0) }; }`,
    });
    const value = inspected.result.value as Omit<FileInputTarget, "backendNodeId"> | undefined;
    if (inspected.exceptionDetails || !value || typeof value.enabled !== "boolean" || typeof value.multiple !== "boolean" ||
      typeof value.directory !== "boolean" || !Number.isSafeInteger(value.fileCount) || value.fileCount < 0 ||
      !Number.isSafeInteger(value.fileBytes) || value.fileBytes < 0)
      throw new Error("Unable to inspect the resolved file input state.");
    return { backendNodeId, ...value };
  } finally {
    await sendDebuggerCommand(tabId, "Runtime.releaseObject", { objectId }).catch(() => undefined);
  }
};

export const resolveFileInputBackendNode = async (request: ActionRequest, tabId: number, signal?: AbortSignal) => {
  const coordinateTarget = request.target?.x !== undefined || request.target?.y !== undefined;
  const node = coordinateTarget ? await nodeFromPoint(request, tabId, signal) : await nodeFromPath(request, tabId, signal);
  const attributes = node.attributes || [];
  const typeIndex = attributes.findIndex((value) => value.toLowerCase() === "type");
  const type = typeIndex >= 0 ? attributes[typeIndex + 1] : undefined;
  if (node.nodeName.toUpperCase() !== "INPUT" || type?.toLowerCase() !== "file") {
    throw new Error("The resolved target is not an input[type=file] element.");
  }
  return inspectFileInputTarget(tabId, node.backendNodeId);
};
