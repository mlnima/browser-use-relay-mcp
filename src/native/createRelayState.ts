import { RELAY_PROTOCOL_VERSION } from "../protocol/version.js";
import type { NativeMessage } from "../types/relay.js";
import type { RelayAddresses, RelaySettings } from "../types/settings.js";

export const createRelayState = (write: (message: NativeMessage) => void) => {
  let settings: RelaySettings = { enabled: false, externalAccess: false };
  let addresses: RelayAddresses = {};
  let listening = false;
  let clients = 0;
  let error: string | undefined;
  let initialized = false;
  let generation = 0;

  const emit = () => write({
    type: "state",
    generation,
    settings,
    addresses,
    status: {
      connected: clients > 0,
      listening,
      nativeVersion: RELAY_PROTOCOL_VERSION,
      ...(error ? { error } : {}),
    },
  });

  const configured = (
    nextGeneration: number,
    next: RelaySettings,
    nextAddresses: RelayAddresses,
    active: boolean,
    message?: string,
  ) => {
    generation = nextGeneration;
    settings = next;
    addresses = nextAddresses;
    listening = active;
    error = message;
    initialized = true;
    emit();
  };

  const connected = (count: number) => {
    clients = count;
    if (initialized) emit();
  };

  const failed = (message: string, stopped = false) => {
    error = message;
    if (stopped) { listening = false; clients = 0; addresses = {}; }
    if (initialized) emit();
  };

  return { configured, connected, failed };
};
