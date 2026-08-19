import { MAX_TRANSFER_CHUNK_BYTES } from "./constants.js";
import { createNativeError } from "./nativeError.js";

const base64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export const decodeTransferChunk = (encoded: string) => {
  if (!base64Pattern.test(encoded))
    throw createNativeError("INVALID_TRANSFER_CHUNK", "The transfer chunk is not valid base64.");
  const chunk = Buffer.from(encoded, "base64");
  if (chunk.length > MAX_TRANSFER_CHUNK_BYTES)
    throw createNativeError("TRANSFER_CHUNK_TOO_LARGE", "The transfer chunk exceeded the native message limit.");
  return chunk;
};
