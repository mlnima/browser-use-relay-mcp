import { endianness } from "node:os";
import type { NativeMessage } from "../types/relay.js";
import { MAX_NATIVE_INPUT_BYTES } from "./constants.js";
import { createNativeError } from "./nativeError.js";
import { writeNativeFrame } from "./writeNativeFrame.js";

const littleEndian = endianness() === "LE";
let outputQueue = Promise.resolve();
let outputFailure: unknown;

const readLength = (buffer: Buffer) =>
  littleEndian ? buffer.readUInt32LE(0) : buffer.readUInt32BE(0);

export const writeNativeMessage = (message: NativeMessage) => {
  if (outputFailure) return Promise.reject(outputFailure);
  outputQueue = outputQueue.then(() => writeNativeFrame(message)).catch((error: unknown) => {
    outputFailure ||= error;
    throw outputFailure;
  });
  return outputQueue;
};

export const flushNativeMessages = () => outputQueue;

export const readNativeMessages = (handle: (message: unknown) => void) =>
  new Promise<void>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let buffered = 0;
    let expected: number | undefined;
    let settled = false;
    const consume = (length: number) => {
      const parts: Buffer[] = [];
      let remaining = length;
      while (remaining > 0) {
        const chunk = chunks[0];
        const size = Math.min(remaining, chunk?.length || 0);
        if (!chunk || size === 0) throw createNativeError("INVALID_NATIVE_FRAME", "Native messaging frame data was incomplete.");
        parts.push(chunk.subarray(0, size));
        size === chunk.length ? chunks.shift() : chunks.splice(0, 1, chunk.subarray(size));
        buffered -= size;
        remaining -= size;
      }
      return parts.length === 1 ? parts[0]! : Buffer.concat(parts, length);
    };
    const clean = () => {
      process.stdin.removeListener("data", receive);
      process.stdin.removeListener("end", ended);
      process.stdin.removeListener("error", failed);
    };
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      clean();
      error ? reject(error) : resolve();
    };
    const receive = (chunk: Buffer) => {
      try {
        chunks.push(chunk);
        buffered += chunk.length;
        while (expected !== undefined || buffered >= 4) {
          if (expected === undefined) expected = readLength(consume(4));
          if (expected > MAX_NATIVE_INPUT_BYTES)
            throw createNativeError("NATIVE_MESSAGE_TOO_LARGE", "Native messaging input exceeded the host limit.");
          if (buffered < expected) break;
          const payload = consume(expected);
          expected = undefined;
          handle(JSON.parse(payload.toString("utf8")) as unknown);
        }
      } catch (error) {
        process.stdin.pause();
        finish(error);
        process.stdin.destroy();
      }
    };
    const ended = () => expected === undefined && buffered === 0
      ? finish()
      : finish(createNativeError("INVALID_NATIVE_FRAME", "Native messaging ended with a partial frame."));
    const failed = (error: Error) => finish(error);
    process.stdin.on("data", receive);
    process.stdin.once("end", ended);
    process.stdin.once("error", failed);
    process.stdin.resume();
  });
