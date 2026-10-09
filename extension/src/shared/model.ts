import type { ActionDelaySettings, InputEngineSettings } from "../../../src/types/settings.js";

export type RelayStatus = "connected" | "listening" | "connecting" | "disconnected" | "error";

export type ExtensionSettings = ActionDelaySettings & InputEngineSettings & {
  enabled: boolean;
  externalAccess: boolean;
  port?: number;
};

export type RelayAddresses = {
  localIp?: string;
  networkIp?: string;
};

export type ExtensionState = {
  settings: ExtensionSettings;
  status: RelayStatus;
  addresses: RelayAddresses;
  statusMessage?: string;
};
