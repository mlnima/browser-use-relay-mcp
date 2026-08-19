import type { RelaySettings } from "../types/settings.js";
import { DEFAULT_RELAY_PORT } from "./constants.js";

export const normalizeRelaySettings = (settings: RelaySettings): RelaySettings => ({
  enabled: settings.enabled === true,
  externalAccess: settings.externalAccess === true,
  ...(Number.isInteger(settings.port) && (settings.port || 0) > 0 && (settings.port || 0) <= 65_535
    ? { port: settings.port }
    : {}),
});

export const requestedRelayPort = (settings: RelaySettings) => settings.port || DEFAULT_RELAY_PORT;
export const relayHost = (settings: RelaySettings) => settings.externalAccess ? "0.0.0.0" : "127.0.0.1";
