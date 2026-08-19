export type RelaySettings = {
  enabled: boolean;
  externalAccess: boolean;
  port?: number;
};

export type RelayAddresses = {
  local?: string;
  network?: string;
};

export type RelayStatus = {
  connected: boolean;
  listening: boolean;
  browser?: string;
  browserVersion?: string;
  nativeVersion?: string;
  error?: string;
};
