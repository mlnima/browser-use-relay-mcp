import { createHash } from "node:crypto";
import type { ActionRequest } from "../types/action.js";
import type { JsonValue } from "../types/json.js";
import { DEFAULT_TRANSFER_CHUNK_BYTES, MAX_TRANSFER_CHUNK_BYTES } from "./constants.js";
import { assertDownloadStable, cancelDownloadSession, finishDownloadSession, getDownloadSession } from "./downloadSessions.js";
import { createNativeError, throwIfAborted } from "./nativeError.js";
import { integerParam, requiredStringParam, stringParam } from "./nativeParams.js";

export const isDownloadTransferRequest = (request: ActionRequest) =>
  request.action === "downloadFile" && (
    stringParam(request, "path") !== undefined || stringParam(request, "operation") === "cancel"
  );

const readChunk = async (session: Awaited<ReturnType<typeof getDownloadSession>>, buffer: Buffer, offset: number, signal: AbortSignal) => {
  let bytesRead = 0;
  while (bytesRead < buffer.length) {
    throwIfAborted(signal);
    const result = await session.file.read(buffer, bytesRead, buffer.length - bytesRead, offset + bytesRead);
    if (!result.bytesRead)
      throw createNativeError("DOWNLOAD_UNEXPECTED_EOF", "The download source ended before its declared size.");
    bytesRead += result.bytesRead;
  }
  return bytesRead;
};

export const executeNativeDownloadTransfer = async (
  request: ActionRequest,
  signal: AbortSignal,
  owner: object,
): Promise<JsonValue | undefined> => {
  const operation = stringParam(request, "operation") || "read";
  if (operation === "cancel") {
    const transferId = requiredStringParam(request, "transferId");
    await cancelDownloadSession(owner, transferId);
    return { transferId, cancelled: true };
  }
  if (operation !== "read")
    throw createNativeError("INVALID_TRANSFER_OPERATION", `Unsupported download transfer operation "${operation}".`);
  const path = requiredStringParam(request, "path");
  const chunkSize = integerParam(request, "chunkSize", DEFAULT_TRANSFER_CHUNK_BYTES);
  if (chunkSize < 1 || chunkSize > MAX_TRANSFER_CHUNK_BYTES)
    throw createNativeError("INVALID_TRANSFER_CHUNK_SIZE", "The requested transfer chunk size is unsupported.");
  const chunkIndex = integerParam(request, "chunkIndex", 0);
  const offset = integerParam(request, "offset", chunkIndex * chunkSize);
  if (chunkIndex < 0 || offset < 0)
    throw createNativeError("INVALID_TRANSFER_OFFSET", "Transfer offsets cannot be negative.");
  const transferId = stringParam(request, "transferId") || request.id;
  const session = await getDownloadSession(owner, transferId, path, chunkSize);
  const length = Math.min(chunkSize, Math.max(0, session.size - offset));
  const buffer = Buffer.allocUnsafe(length);
  try {
    throwIfAborted(signal);
    const bytesRead = await readChunk(session, buffer, offset, signal);
    throwIfAborted(signal);
    await assertDownloadStable(session);
    const chunk = buffer.subarray(0, bytesRead);
    const complete = bytesRead === 0 || offset + bytesRead >= session.size;
    if (complete) await finishDownloadSession(session);
    return {
      transferId, chunkIndex, offset, totalBytes: session.size, bytesRead,
      chunkBase64: chunk.toString("base64"),
      chunkSha256: createHash("sha256").update(chunk).digest("hex"),
      complete,
    };
  } catch (error) {
    await finishDownloadSession(session).catch(() => undefined);
    throw error;
  }
};
