import type { ActionRequest, ActionResult } from "../types/action.js";
import type { NativeMessage } from "../types/relay.js";
import { failedActionResult } from "./actionResult.js";
import { MAX_NATIVE_OUTPUT_BYTES } from "./constants.js";

export const extensionActionReply = (
  write: (message: NativeMessage) => void,
  request: ActionRequest,
) => (result: ActionResult) => {
  const message = { type: "actionResult", result } as const;
  if (Buffer.byteLength(JSON.stringify(message)) <= MAX_NATIVE_OUTPUT_BYTES) {
    write(message);
    return;
  }
  write({
    type: "actionResult",
    result: failedActionResult(
      { ...request, engine: "native" },
      "RESULT_TRANSPORT_FAILED",
      "The native action result exceeded the browser native-messaging output limit.",
      result.durationMs,
    ),
  });
};
