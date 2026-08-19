import { endianness } from "node:os";
import type { NativeMessage } from "../types/relay.js";
import { MAX_NATIVE_OUTPUT_BYTES } from "./constants.js";
import { createNativeError } from "./nativeError.js";

const littleEndian = endianness() === "LE";

export const writeNativeFrame = (message: NativeMessage) => {
  const payload = Buffer.from(JSON.stringify(message));
  if (payload.length > MAX_NATIVE_OUTPUT_BYTES)
    throw createNativeError("NATIVE_MESSAGE_TOO_LARGE", "Native messaging output exceeded the browser limit.");
  const header = Buffer.allocUnsafe(4);
  littleEndian ? header.writeUInt32LE(payload.length, 0) : header.writeUInt32BE(payload.length, 0);
  const frame = Buffer.concat([header, payload]);
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const complete = (error?: Error | null) => {
      if (settled) return;
      settled = true;
      process.stdout.removeListener("error", complete);
      error ? reject(error) : resolve();
    };
    process.stdout.once("error", complete);
    try {
      process.stdout.write(frame, complete);
    } catch (error) {
      complete(error instanceof Error ? error : new Error(String(error)));
    }
  });
};
