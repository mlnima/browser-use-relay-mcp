import type { RuntimeRequest, RuntimeResponse } from "../../shared/messages";
import { runtimeMessage } from "../../shared/messages";
import type { SettingsIntent } from "../state/state-store";
import { getState, loadState, updateSettings } from "../state/state-store";

type Configure = (intent: SettingsIntent, resetSession: boolean) => void | Promise<void>;
type Quiesce = (intent: SettingsIntent) => void | Promise<void>;

export const createRuntimeRequestHandler = (configure: Configure, quiesce: Quiesce) => {
  let settingsQueue = Promise.resolve();
  const handle = async (request: RuntimeRequest): Promise<RuntimeResponse> => {
    try {
      await loadState();
      if (request.type === runtimeMessage.getState) return { ok: true, state: getState() };
      if (request.type === runtimeMessage.openOptions) {
        await chrome.runtime.openOptionsPage();
        return { ok: true, state: getState() };
      }
      if (request.type === runtimeMessage.applyPort && (!Number.isInteger(request.port) || request.port < 1 || request.port > 65_535)) {
        throw new Error("Port must be an integer from 1 to 65535.");
      }
      const patch = request.type === runtimeMessage.setEnabled
        ? { enabled: request.enabled }
        : request.type === runtimeMessage.setExternalAccess
          ? { externalAccess: request.enabled }
          : request.type === runtimeMessage.applyPort
            ? { port: request.port }
            : {};
      const quiesceRequired = getState().settings.enabled && (request.type === runtimeMessage.setExternalAccess ||
        request.type === runtimeMessage.applyPort || request.type === runtimeMessage.setEnabled && !request.enabled);
      const intent = await updateSettings(patch, quiesceRequired ? quiesce : undefined);
      const resetSession = intent.settings.enabled &&
        (request.type === runtimeMessage.setExternalAccess || request.type === runtimeMessage.applyPort);
      await configure(intent, resetSession && !quiesceRequired);
      return { ok: true, state: getState() };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "The requested settings change failed." };
    }
  };
  return (request: RuntimeRequest) => {
    if (request.type === runtimeMessage.getState || request.type === runtimeMessage.openOptions) return handle(request);
    const operation = settingsQueue.then(() => handle(request));
    settingsQueue = operation.then(() => undefined, () => undefined);
    return operation;
  };
};
