import type { NativeState } from "../../../../src/types/relay.js";
import { INITIAL_SETTINGS, SETTINGS_STORAGE_KEY } from "../../shared/defaults";
import type { ExtensionSettings, ExtensionState } from "../../shared/model";
import { runtimeMessage } from "../../shared/messages";

let state: ExtensionState = {
  settings: { ...INITIAL_SETTINGS },
  status: "disconnected",
  addresses: {},
};
let generation = 0;
let storageQueue = Promise.resolve();
let loadPromise: Promise<ExtensionState> | undefined;

export type SettingsIntent = Readonly<{ generation: number; settings: ExtensionSettings }>;
type BeforeSettingsUpdate = (intent: SettingsIntent) => void | Promise<void>;

const publish = () => void chrome.runtime.sendMessage({ type: runtimeMessage.stateChanged, state }).catch(() => undefined);
const persistSettings = (settings: ExtensionSettings) => {
  const captured = { ...settings };
  const operation = storageQueue.then(() => chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: captured }));
  storageQueue = operation.then(() => undefined, () => undefined);
  return operation;
};

const loadStoredState = async () => {
  const stored = await chrome.storage.local.get(SETTINGS_STORAGE_KEY);
  if (generation > 0) return state;
  const settings = stored[SETTINGS_STORAGE_KEY] as Partial<ExtensionSettings> | undefined;
  state = { ...state, settings: { ...INITIAL_SETTINGS, ...settings } };
  generation = 1;
  if (!settings) await persistSettings(state.settings);
  return state;
};
export const loadState = () => loadPromise ||= loadStoredState();

export const getState = () => state;
export const getSettingsIntent = (): SettingsIntent => ({ generation, settings: { ...state.settings } });
export const isCurrentSettingsGeneration = (candidate: number) => candidate === generation;

export const updateSettings = async (patch: Partial<ExtensionSettings>, beforeUpdate?: BeforeSettingsUpdate) => {
  const settings = { ...state.settings, ...patch };
  generation += 1;
  const intent = { generation, settings: { ...settings } } satisfies SettingsIntent;
  await beforeUpdate?.(intent);
  if (!isCurrentSettingsGeneration(intent.generation)) return intent;
  state = settings.enabled
    ? { ...state, settings, status: "connecting", statusMessage: undefined }
    : { ...state, settings, status: "disconnected", addresses: {}, statusMessage: undefined };
  publish();
  await persistSettings(settings);
  return intent;
};

export const updateNativeState = async (message: NativeState) => {
  if (message.generation !== generation) return undefined;
  const next = message.settings.enabled ? {
    settings: { ...message.settings },
    status: message.status.error ? "error" : message.status.connected ? "connected" : message.status.listening ? "listening" : "connecting",
    addresses: { localIp: message.addresses.local, networkIp: message.addresses.network },
    statusMessage: message.status.error,
  } satisfies ExtensionState : { settings: { ...message.settings }, status: "disconnected", addresses: {} } satisfies ExtensionState;
  state = next;
  publish();
  await persistSettings(next.settings);
  return message.generation === generation ? next : undefined;
};

export const updateConnectionState = (status: ExtensionState["status"], statusMessage?: string) => {
  state = { ...state, status, statusMessage };
  publish();
};
