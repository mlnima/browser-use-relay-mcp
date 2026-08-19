import clipboard from "clipboardy";
import type { ActionRequest } from "../types/action.js";
import type { JsonValue } from "../types/json.js";
import { MAX_NATIVE_CLIPBOARD_OUTPUT_BYTES } from "./constants.js";
import { createNativeError } from "./nativeError.js";
import { assertNativeKeyAvailable, tapNativeKeys } from "./nativeInputState.js";
import { platformModifier, resolveKey } from "./nativeKeys.js";
import { requiredStringParam, stringParam } from "./nativeParams.js";

const clipboardShortcut = (key: string) => tapNativeKeys([platformModifier(), resolveKey(key)]);
const awaitClipboard = <T>(pending: Promise<T>, signal: AbortSignal) => {
  let rejectAbort = (_error: Error): void => undefined;
  const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
  const abort = () => rejectAbort(signal.reason instanceof Error ? signal.reason : new Error("Clipboard action cancelled."));
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  return Promise.race([pending, aborted]).finally(() => signal.removeEventListener("abort", abort));
};
const readClipboard = async (signal: AbortSignal) => {
  const text = await awaitClipboard(clipboard.read(), signal);
  if (Buffer.byteLength(JSON.stringify(text)) > MAX_NATIVE_CLIPBOARD_OUTPUT_BYTES)
    throw createNativeError("NATIVE_CLIPBOARD_LIMIT", "The clipboard text exceeds the native output limit.");
  return { text };
};

export const executeNativeClipboard = async (
  request: ActionRequest,
  signal: AbortSignal,
): Promise<JsonValue | undefined> => {
  const trigger = request.action === "copy" ? resolveKey("C") : request.action === "cut" ? resolveKey("X")
    : request.action === "paste" ? resolveKey("V") : undefined;
  assertNativeKeyAvailable(trigger);
  switch (request.action) {
    case "readClipboard": return readClipboard(signal);
    case "writeClipboard": {
      const text = requiredStringParam(request, "text");
      await awaitClipboard(clipboard.write(text), signal);
      return { characters: Array.from(text).length };
    }
    case "copy": await clipboardShortcut("C"); return { copied: true };
    case "cut": await clipboardShortcut("X"); return { cut: true };
    default: {
      const text = stringParam(request, "text");
      if (text !== undefined) await awaitClipboard(clipboard.write(text), signal);
      await clipboardShortcut("V");
      return { pasted: true };
    }
  }
};
