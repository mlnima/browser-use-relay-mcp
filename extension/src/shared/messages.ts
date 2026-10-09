import type { ActionDelaySettings, InputEngine } from "../../../src/types/settings.js";
import type { ExtensionState } from "./model";

export const runtimeMessage = {
  getState: "relay.getState",
  setEnabled: "relay.setEnabled",
  setExternalAccess: "relay.setExternalAccess",
  applyPort: "relay.applyPort",
  applyActionDelay: "relay.applyActionDelay",
  setInputEngine: "relay.setInputEngine",
  openOptions: "relay.openOptions",
  stateChanged: "relay.stateChanged",
} as const;

export type RuntimeRequest =
  | { type: typeof runtimeMessage.getState }
  | { type: typeof runtimeMessage.setEnabled; enabled: boolean }
  | { type: typeof runtimeMessage.setExternalAccess; enabled: boolean }
  | { type: typeof runtimeMessage.applyPort; port: number }
  | ({ type: typeof runtimeMessage.applyActionDelay } & ActionDelaySettings)
  | { type: typeof runtimeMessage.setInputEngine; inputEngine: InputEngine }
  | { type: typeof runtimeMessage.openOptions };

export type RuntimeResponse =
  | { ok: true; state: ExtensionState }
  | { ok: false; error: string };

export type StateChangedMessage = {
  type: typeof runtimeMessage.stateChanged;
  state: ExtensionState;
};
