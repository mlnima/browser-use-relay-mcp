export type RelayStatus = "connected" | "listening" | "connecting" | "disconnected" | "error";

export type ExtensionSettings = {
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
