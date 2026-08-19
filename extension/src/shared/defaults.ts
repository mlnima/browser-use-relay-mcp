import type { ExtensionSettings } from "./model";

export const SETTINGS_STORAGE_KEY = "relay.settings";
export const INITIAL_SETTINGS: ExtensionSettings = { enabled: false, externalAccess: false, port: 32145 };
