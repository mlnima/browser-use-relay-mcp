import type { ActionRequest } from "../../../src/types/action.js";
import type { NativeMessage } from "../../../src/types/relay.js";
import type { RuntimeRequest } from "../shared/messages";
import { runtimeMessage } from "../shared/messages";
import { executeActionRequest } from "./actions/execute-action";
import { duplicateActionResult } from "./actions/duplicate-action-result";
import { registerEventForwarding } from "./events/register-event-forwarding";
import { createNativeBridge } from "./native/native-bridge";
import { createNativeActionTransport } from "./native/native-action-transport";
import { createRuntimeRequestHandler } from "./runtime/handle-runtime-request";
import { resetControlSession, waitForControlSession } from "./session/control-session";
import type { SettingsIntent } from "./state/state-store";
import { getSettingsIntent, getState, isCurrentSettingsGeneration, loadState, updateConnectionState, updateNativeState } from "./state/state-store";
const controllers = new Map<string, AbortController>(); const executions = new Set<Promise<unknown>>();
let initialized = false;
const receiveNativeMessage = (message: NativeMessage) => {
  if (!getState().settings.enabled) return;
  if (message.type === "state") {
    const disconnecting = isCurrentSettingsGeneration(message.generation) && getState().status === "connected" && !message.status.connected;
    const cleanup = disconnecting ? resetControlSession(controllers, executions, nativeActions, "The MCP client disconnected.") : undefined;
    void updateNativeState(message).then((update) => update ? !update.settings.enabled ? disableControl() : cleanup : undefined);
  }
  if (message.type === "cancel") controllers.get(message.id)?.abort(new Error(message.reason || "Cancelled"));
  if (message.type === "actionRequest") void runAction(message.request);
  if (message.type === "actionResult") nativeActions.complete(message.result);
};
const bridge = createNativeBridge({
  onMessage: receiveNativeMessage,
  onDisconnect: (error) => {
    void resetControlSession(controllers, executions, nativeActions, error || "Native relay disconnected.");
    if (!getState().settings.enabled) return updateConnectionState("disconnected");
    initialized = false;
    updateConnectionState("error", error || "Native relay disconnected.");
    void chrome.alarms.create("relay.nativeReconnect", { delayInMinutes: 0.05 });
  },
});
const nativeActions = createNativeActionTransport((message) => bridge.send(message));
const disableControl = async () => {
  await resetControlSession(controllers, executions, nativeActions, "Browser control was disabled.");
  bridge.disconnect();
  updateConnectionState("disconnected");
};
const runAction = async (request: ActionRequest) => {
  if (controllers.has(request.id)) return bridge.sendResult(duplicateActionResult(request));
  const controller = new AbortController();
  controllers.set(request.id, controller);
  await waitForControlSession();
  if (!getState().settings.enabled || controller.signal.aborted) return void (controllers.get(request.id) === controller && controllers.delete(request.id));
  const execution = executeActionRequest(request, controller.signal, nativeActions.execute);
  executions.add(execution);
  const result = await execution.catch((error: unknown) => ({
    id: request.id,
    success: false,
    engine: request.engine === "native" ? "native" as const : "browser" as const,
    error: { code: "ACTION_FAILED", message: error instanceof Error ? error.message : "Action execution failed.", retryable: false },
    durationMs: 0,
  }));
  executions.delete(execution);
  const current = controllers.get(request.id) === controller;
  if (current) controllers.delete(request.id);
  if (current && !controller.signal.aborted && getState().settings.enabled) bridge.sendResult(result);
};
const connectRelay = async (intent: SettingsIntent) => {
  await waitForControlSession();
  if (!intent.settings.enabled || !isCurrentSettingsGeneration(intent.generation)) return;
  try {
    bridge.connect();
    bridge.configure(intent.generation, intent.settings);
  } catch (error) {
    initialized = false;
    updateConnectionState("error", error instanceof Error ? error.message : "Native host connection failed.");
    void chrome.alarms.create("relay.nativeReconnect", { delayInMinutes: 0.05 });
  }
};
const initialize = async () => {
  if (initialized) return;
  initialized = true;
  await loadState();
  if (getState().settings.enabled) await connectRelay(getSettingsIntent());
  else await disableControl();
};
const handleRuntimeRequest = createRuntimeRequestHandler(async (intent, resetSession) => {
  if (!isCurrentSettingsGeneration(intent.generation)) return;
  if (!intent.settings.enabled) return disableControl();
  initialized = true;
  if (resetSession) await resetControlSession(controllers, executions, nativeActions, "Relay settings changed.");
  await connectRelay(intent);
}, async (intent) => {
  if (!isCurrentSettingsGeneration(intent.generation)) return;
  initialized = true;
  const quiescing = bridge.quiesce(intent.generation);
  const message = intent.settings.enabled ? "Relay settings changed." : "Browser control was disabled.";
  await Promise.all([quiescing, resetControlSession(controllers, executions, nativeActions, message, quiescing)]);
});
chrome.runtime.onMessage.addListener((message: RuntimeRequest) => message?.type && Object.values(runtimeMessage).includes(message.type as never) ? handleRuntimeRequest(message) : undefined);
registerEventForwarding(() => getState().settings.enabled && getState().status === "connected", (message) => bridge.send(message));
chrome.alarms.onAlarm.addListener((alarm) => alarm.name === "relay.nativeReconnect" && getState().settings.enabled && void initialize());
chrome.runtime.onInstalled.addListener(() => void initialize());
chrome.runtime.onStartup.addListener(() => void initialize());
void initialize();
