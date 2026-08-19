import WebSocket from "ws";
import type { ActionRequest } from "../types/action.js";
import type { NativeMessage } from "../types/relay.js";
import { getActionDefinition } from "../protocol/actionCatalog.js";
import { failedActionResult } from "./actionResult.js";
import { MAX_ACTIVE_ACTIONS, MAX_ACTIVE_ACTIONS_PER_OWNER } from "./constants.js";
import type { createForwardedActions } from "./createForwardedActions.js";
import type { createNativeRunner } from "./createNativeRunner.js";
import { canExecuteNativeAction } from "./executeNativeAction.js";
import { extensionActionReply } from "./extensionActionReply.js";

type Forwarded = ReturnType<typeof createForwardedActions>;
type Runner = ReturnType<typeof createNativeRunner>;
export const handleExtensionNativeAction = (
  write: (message: NativeMessage) => void,
  request: ActionRequest,
  runner: Runner,
  forwarded: Forwarded,
  extensionOwner: object,
) => {
  const reply = extensionActionReply(write, request);
  const forwardedOwner = forwarded.ownerForExtensionAction(request.id);
  if (forwarded.isForwardedExtensionAction(request.id) &&
    (!forwardedOwner || forwardedOwner.readyState !== WebSocket.OPEN)) {
    reply(failedActionResult(request, "ACTION_CANCELLED", "The originating relay session is no longer active."));
    return;
  }
  const owner = forwardedOwner || extensionOwner;
  if (runner.has(request.id)) {
    reply(failedActionResult(request, "DUPLICATE_ACTION_ID", `Action id "${request.id}" is already active.`));
    return;
  }
  const definition = getActionDefinition(request.action);
  if (!definition?.engines.some((engine) => engine === "native") || !canExecuteNativeAction(request)) {
    reply(failedActionResult(request, "NATIVE_ACTION_UNAVAILABLE", `Native action "${request.action}" is not available on this host.`));
    return;
  }
  if (runner.count() + forwarded.count() >= MAX_ACTIVE_ACTIONS ||
    runner.countOwner(owner) + forwarded.countOwner(owner) >= MAX_ACTIVE_ACTIONS_PER_OWNER) {
    reply(failedActionResult(request, "ACTION_QUEUE_BUSY", "The native relay action queue is at capacity.", 0, true));
    return;
  }
  runner.execute({ ...request, engine: "native" }, owner, reply);
};
