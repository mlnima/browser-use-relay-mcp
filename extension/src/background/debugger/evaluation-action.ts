import type { ActionRequest } from "../../../../src/types/action.js";
import type { JsonValue } from "../../../../src/types/json.js";
import { resolveElementPath, resolvePoint, type ElementPathStep } from "./resolve-point";
import { resolveCdpFrame } from "./resolve-cdp-frame";
import { sendDebuggerCommand } from "./debugger-session";
import { waitForMainContext } from "./runtime-context-store";
import { resolveBrowserFrameId } from "./frame-coordinates";

type RemoteObject = { objectId?: string; value?: JsonValue; unserializableValue?: string; description?: string };
type EvaluateResult = { result: RemoteObject; exceptionDetails?: { text?: string; exception?: RemoteObject } };
type IsolatedWorld = { executionContextId: number };
type ResolvedNode = { object: RemoteObject };
type LocatedNode = { backendNodeId: number };
const actions = new Set(["evaluateReadOnly", "evaluate", "evaluateOnElement", "evaluateInFrame"]);

const contextFor = async (request: ActionRequest, tabId: number, signal?: AbortSignal) => {
  const browserFrameId = await resolveBrowserFrameId(request, tabId);
  const frameId = typeof request.params?.cdpFrameId === "string"
    ? request.params.cdpFrameId
    : await resolveCdpFrame(tabId, browserFrameId);
  if (String(request.params?.world || "MAIN").toUpperCase() === "ISOLATED") {
    const world = await sendDebuggerCommand<IsolatedWorld>(tabId, "Page.createIsolatedWorld", {
      frameId,
      worldName: "browser-relay-readonly",
      grantUniveralAccess: false,
    });
    return world.executionContextId;
  }
  return browserFrameId || request.params?.cdpFrameId ? waitForMainContext(tabId, frameId, signal) : undefined;
};
const valueFrom = (response: EvaluateResult) => {
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text || "Evaluation failed.");
  return response.result.value ?? response.result.unserializableValue ?? null;
};
const evaluationOptions = (request: ActionRequest) => ({
  awaitPromise: true,
  returnByValue: true,
  throwOnSideEffect: true,
  userGesture: false,
  ...(request.timeoutMs !== undefined && { timeout: request.timeoutMs }),
});

const pathExpression = (path: ElementPathStep[]) => `(()=>{const path=${JSON.stringify(path)};let node;for(const step of path){if(step.scope==="document")node=document.children[step.index];else if(step.scope==="children")node=node?.children[step.index];else node=node?.shadowRoot?.children[step.index];if(!node)return null;}return node;})()`;

const objectFor = async (request: ActionRequest, tabId: number, contextId?: number, signal?: AbortSignal) => {
  if (request.target?.x !== undefined || request.target?.y !== undefined) {
    const position = await resolvePoint(request, tabId, signal);
    const located = await sendDebuggerCommand<LocatedNode>(tabId, "DOM.getNodeForLocation", { ...position, includeUserAgentShadowDOM: true });
    return (await sendDebuggerCommand<ResolvedNode>(tabId, "DOM.resolveNode", {
      backendNodeId: located.backendNodeId,
      ...(contextId !== undefined && { executionContextId: contextId }),
    })).object;
  }
  const path = await resolveElementPath(request, signal);
  const located = await sendDebuggerCommand<EvaluateResult>(tabId, "Runtime.evaluate", {
    expression: pathExpression(path),
    returnByValue: false,
    throwOnSideEffect: true,
    ...(contextId !== undefined && { contextId }),
  });
  if (located.exceptionDetails || !located.result.objectId) throw new Error("Unable to resolve the target in its execution context.");
  return located.result;
};

const evaluateOnElement = async (request: ActionRequest, tabId: number, contextId?: number, signal?: AbortSignal) => {
  const object = await objectFor(request, tabId, contextId, signal);
  if (!object.objectId) throw new Error("Unable to resolve the exact target in its execution context.");
  try {
    const response = await sendDebuggerCommand<EvaluateResult>(tabId, "Runtime.callFunctionOn", {
      objectId: object.objectId,
      functionDeclaration: `(element) => (${String(request.params?.expression ?? "element")})`,
      arguments: [{ objectId: object.objectId }],
      ...evaluationOptions(request),
    });
    return valueFrom(response);
  } finally {
    await sendDebuggerCommand(tabId, "Runtime.releaseObject", { objectId: object.objectId }).catch(() => undefined);
  }
};

export const executeEvaluationAction = async (request: ActionRequest, tabId: number, signal?: AbortSignal): Promise<JsonValue | undefined> => {
  if (!actions.has(request.action)) return undefined;
  const contextId = await contextFor(request, tabId, signal);
  if (request.action === "evaluateOnElement") return evaluateOnElement(request, tabId, contextId, signal);
  const response = await sendDebuggerCommand<EvaluateResult>(tabId, "Runtime.evaluate", {
    expression: String(request.params?.expression ?? "undefined"),
    ...evaluationOptions(request),
    ...(contextId !== undefined && { contextId }),
  });
  return valueFrom(response);
};
