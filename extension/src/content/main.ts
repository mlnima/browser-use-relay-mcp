import type { ActionResult } from "../../../src/types/action.js";
import type { ContentMessage } from "../shared/content-messages";
import { contentMessage } from "../shared/content-messages";
import { INITIAL_SETTINGS, SETTINGS_STORAGE_KEY } from "../shared/defaults";
import type { ExtensionSettings } from "../shared/model";
import { executeContentAction } from "./actions/execute-content-action";
import { startPageEventObservation } from "./observation/page-event-observation";
import { getRevision } from "./observation/revision";

type ContentScope = typeof globalThis & { __browserRelayContentInitialized__?: boolean };

const disabledResult = (id: string): ActionResult => ({
  id,
  success: false,
  engine: "dom",
  error: { code: "CONTENT_DISABLED", message: "Browser control is disabled in the extension.", retryable: false },
  revision: getRevision(),
  durationMs: 0,
});
const duplicateResult = (id: string): ActionResult => ({
  id, success: false, engine: "dom",
  error: { code: "DUPLICATE_ACTION_ID", message: `Action id "${id}" is already active in this frame.`, retryable: true },
  revision: getRevision(), durationMs: 0,
});

const initializeContent = (): void => {
  const controllers = new Map<string, AbortController>();
  const release = (id: string, controller: AbortController) => controllers.get(id) === controller && controllers.delete(id);
  let enabled = false;
  let stopPageEvents: (() => void) | undefined;
  const setEnabled = (next: boolean): void => {
    if (enabled === next) return;
    enabled = next;
    if (enabled) {
      stopPageEvents = startPageEventObservation();
      return;
    }
    stopPageEvents?.();
    stopPageEvents = undefined;
    for (const [id, controller] of controllers) { controller.abort(new Error("Browser control was disabled.")); release(id, controller); }
  };
  const loadEnabled = async (): Promise<void> => {
    const stored = await chrome.storage.local.get(SETTINGS_STORAGE_KEY);
    const settings = stored[SETTINGS_STORAGE_KEY] as ExtensionSettings | undefined;
    setEnabled(settings?.enabled ?? INITIAL_SETTINGS.enabled);
  };
  const ready = loadEnabled().catch(() => setEnabled(INITIAL_SETTINGS.enabled));
  const handleMessage = async (message: ContentMessage) => {
    if (message.type === contentMessage.cancel) {
      const controller = controllers.get(message.id);
      controller?.abort(new Error(message.reason || "Cancelled"));
      controller && release(message.id, controller);
      return undefined;
    }
    if (message.type !== contentMessage.action) return undefined;
    const id = message.request.id;
    if (controllers.has(id)) return duplicateResult(id);
    const controller = new AbortController();
    controllers.set(id, controller);
    try {
      await ready;
      if (!enabled && !controller.signal.aborted) return disabledResult(id);
      return await executeContentAction(message.request, controller.signal);
    } finally {
      release(id, controller);
    }
  };
  chrome.runtime.onMessage.addListener((message: ContentMessage) => handleMessage(message));
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[SETTINGS_STORAGE_KEY]) return;
    const settings = changes[SETTINGS_STORAGE_KEY].newValue as ExtensionSettings | undefined;
    setEnabled(settings?.enabled ?? INITIAL_SETTINGS.enabled);
  });
};

const contentScope = globalThis as ContentScope;
if (!contentScope.__browserRelayContentInitialized__) {
  contentScope.__browserRelayContentInitialized__ = true;
  initializeContent();
}
