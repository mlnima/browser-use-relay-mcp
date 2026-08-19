import type { ExtensionState } from "./model";

export const runtimeMessage = {
  getState: "relay.getState",
  setEnabled: "relay.setEnabled",
  setExternalAccess: "relay.setExternalAccess",
  applyPort: "relay.applyPort",
  openOptions: "relay.openOptions",
  stateChanged: "relay.stateChanged",
} as const;

export type RuntimeRequest =
  | { type: typeof runtimeMessage.getState }
  | { type: typeof runtimeMessage.setEnabled; enabled: boolean }
  | { type: typeof runtimeMessage.setExternalAccess; enabled: boolean }
  | { type: typeof runtimeMessage.applyPort; port: number }
  | { type: typeof runtimeMessage.openOptions };

export type RuntimeResponse =
  | { ok: true; state: ExtensionState }
  | { ok: false; error: string };

export type StateChangedMessage = {
  type: typeof runtimeMessage.stateChanged;
  state: ExtensionState;
};
