import type { ActionResult } from "../../../../src/types/action.js";
import type { NativeMessage } from "../../../../src/types/relay.js";
import { boundedActionError } from "../../../../src/protocol/actionError.js";
import { NATIVE_HOST_NAME } from "../../../../src/protocol/version.js";
import type { ExtensionSettings } from "../../shared/model";
import { MAX_EXTENSION_NATIVE_MESSAGE_BYTES } from "../../../../src/protocol/limits.js";
import { jsonFitsByteLimit } from "./json-byte-limit";
import { jsonValueFitsLimits } from "./json-value-limit";

type Handlers = {
  onMessage: (message: NativeMessage) => void;
  onDisconnect: (error?: string) => void;
};
type QuiesceWaiter = { resolve: () => void; reject: (error: Error) => void };
const boundedResult = (result: ActionResult): ActionResult => !result.error ? result : {
  ...result,
  error: boundedActionError({
    ...result.error,
    ...(result.error.details !== undefined && !jsonValueFitsLimits(result.error.details) ? { details: undefined } : {}),
  }),
};
export const createNativeBridge = ({ onMessage, onDisconnect }: Handlers) => {
  let port: chrome.runtime.Port | undefined;
  const quiesceWaiters = new Map<number, QuiesceWaiter>();
  const receive = (message: NativeMessage) => {
    if (message.type !== "quiesced") return onMessage(message);
    const waiter = quiesceWaiters.get(message.generation);
    if (!waiter) return;
    quiesceWaiters.delete(message.generation);
    waiter.resolve();
  };
  const rejectQuiesces = (message: string) => {
    for (const waiter of quiesceWaiters.values()) waiter.reject(new Error(message));
    quiesceWaiters.clear();
  };

  const connect = () => {
    if (port) return port;
    const connected = chrome.runtime.connectNative(NATIVE_HOST_NAME);
    port = connected;
    connected.onMessage.addListener((message: NativeMessage) => receive(message));
    connected.onDisconnect.addListener(() => {
      if (port !== connected) return;
      const error = chrome.runtime.lastError?.message;
      port = undefined;
      rejectQuiesces(error || "Native relay disconnected.");
      onDisconnect(error);
    });
    return connected;
  };

  const send = (message: NativeMessage) => {
    if (!port) throw new Error("Native relay is disconnected.");
    if (!jsonValueFitsLimits(message)) throw new Error("Native relay message exceeds the JSON structure limit.");
    if (!jsonFitsByteLimit(message, MAX_EXTENSION_NATIVE_MESSAGE_BYTES)) throw new Error("Native relay message exceeds the browser transport limit.");
    port.postMessage(message);
  };
  const configure = (generation: number, settings: ExtensionSettings) =>
    send({ type: "configure", generation, settings: { ...settings } });
  const quiesce = (generation: number) => new Promise<void>((resolve, reject) => {
    quiesceWaiters.set(generation, { resolve, reject });
    try {
      connect();
      send({ type: "quiesce", generation });
    } catch (error) {
      quiesceWaiters.delete(generation);
      reject(error instanceof Error ? error : new Error("Native relay quiesce failed."));
    }
  });
  const sendResult = (result: ActionResult) => {
    const bounded = boundedResult(result);
    try {
      send({ type: "actionResult", result: bounded });
    } catch (error) {
      try {
        send({
          type: "actionResult",
          result: {
            id: bounded.id,
            success: false,
            engine: bounded.engine,
            error: boundedActionError({ code: "RESULT_TRANSPORT_FAILED", message: error instanceof Error ? error.message : "Action result transport failed.", retryable: false }),
            durationMs: bounded.durationMs,
          },
        });
      } catch {
        disconnect();
      }
    }
  };
  const disconnect = () => {
    const connected = port;
    port = undefined;
    rejectQuiesces("Native relay disconnected.");
    connected?.disconnect();
  };
  return { connect, configure, quiesce, sendResult, send, disconnect };
};
