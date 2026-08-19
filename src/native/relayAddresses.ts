import type { RelayAddresses } from "../types/settings.js";

export const relayAddresses = (networkAddress?: string): RelayAddresses => ({
  local: "127.0.0.1",
  ...(networkAddress ? { network: networkAddress } : {}),
});
