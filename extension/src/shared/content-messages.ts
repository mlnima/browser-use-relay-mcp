import type { ActionRequest, ActionResult } from "../../../src/types/action.js";

export const contentMessage = {
  action: "relay.contentAction",
  cancel: "relay.contentCancel",
  changed: "relay.contentChanged",
} as const;

export type ContentActionMessage = { type: typeof contentMessage.action; request: ActionRequest };
export type ContentCancelMessage = { type: typeof contentMessage.cancel; id: string; reason?: string };
export type ContentChangedMessage = {
  type: typeof contentMessage.changed;
  revision: number;
  url: string;
  reasons: string[];
  error?: { message: string; source?: string; line?: number; column?: number; stack?: string; revision?: number };
};
export type ContentMessage = ContentActionMessage | ContentCancelMessage | ContentChangedMessage;
export type ContentActionResponse = ActionResult;
