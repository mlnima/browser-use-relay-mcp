import WebSocket from "ws";
import type { ActionRequest, NativePage } from "../types/action.js";
import type { NativeMessage } from "../types/relay.js";
import { getActionDefinition, resolveInputAction } from "../protocol/actionCatalog.js";
import type { InputEngine } from "../types/settings.js";
import { failedActionResult } from "./actionResult.js";
import type { createForwardedActions } from "./createForwardedActions.js";
import type { createNativeRunner } from "./createNativeRunner.js";
import { canExecuteNativeAction } from "./executeNativeAction.js";
import { extensionActionReply } from "./extensionActionReply.js";
import { nativePageInputHeld } from "./page/nativePageScope.js";

type Forwarded = ReturnType<typeof createForwardedActions>;
type Runner = ReturnType<typeof createNativeRunner>;
export const handleExtensionNativeAction = (
  write: (message: NativeMessage) => void,
  request: ActionRequest,
  runner: Runner,
  forwarded: Forwarded,
  extensionOwner: object,
  inputEngine?: InputEngine,
  page?: NativePage,
) => {
  const reply = extensionActionReply(write, request, () => nativePageInputHeld(page?.observation));
  try {
    request = resolveInputAction({ ...request, engine: "native" }, inputEngine);
  } catch (error) {
    reply(failedActionResult(request, "INPUT_ENGINE_RESTRICTED", error instanceof Error ? error.message : "The input engine is restricted."));
    return;
  }
  const forwardedOwner = forwarded.ownerForExtensionAction(request.id);
  if (forwarded.isForwardedExtensionAction(request.id) &&
    (!forwardedOwner || forwardedOwner.readyState !== WebSocket.OPEN)) {
    reply(failedActionResult(request, "ACTION_CANCELLED", "The originating relay session is no longer active."));
    return;
  }
  const owner = forwardedOwner || extensionOwner;
  if (runner.has(request.id, owner)) {
    reply(failedActionResult(request, "DUPLICATE_ACTION_ID", `Action id "${request.id}" is already active.`));
    return;
  }
  const definition = getActionDefinition(request.action);
  if (!definition?.engines.some((engine) => engine === "native") || !canExecuteNativeAction(request)) {
    reply(failedActionResult(request, "NATIVE_ACTION_UNAVAILABLE", `Native action "${request.action}" is not available on this host.`));
    return;
  }
  runner.execute({ ...request, engine: "native" }, owner, reply, undefined, page);
};
