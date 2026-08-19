import { open, type FileHandle } from "node:fs/promises";
import { basename } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { RelayClient } from "../../types/mcp.js";
import { createActionRequest } from "../createActionRequest.js";
import type { UploadSource } from "./collectUploadFiles.js";
export const UPLOAD_CHUNK_BYTES = 512 * 1024;
const requireSuccess = (result: Awaited<ReturnType<RelayClient["execute"]>>) => {
  if (!result.success) throw new Error(result.error?.message || "Native file transfer failed.");
  if (!result.data || typeof result.data !== "object" || Array.isArray(result.data))
    throw new Error("Native file transfer returned invalid result data.");
  return result.data as Record<string, unknown>;
};
export type UploadCleanupFailure = { transferId: string; message: string };
export const getUploadCleanupFailure = (error: unknown): UploadCleanupFailure | undefined => error instanceof Error
  ? (error as Error & { uploadCleanupFailure?: UploadCleanupFailure }).uploadCleanupFailure
  : undefined;
const exposeCleanupFailure = (error: unknown, failure: UploadCleanupFailure) => Object.assign(
  error instanceof Error ? error : new Error(String(error), { cause: error }),
  { uploadCleanupFailure: failure },
);
const cancelRemote = async (client: RelayClient, transferId: string) => {
  try {
    const result = await client.execute(createActionRequest({
      action: "uploadFile", engine: "native", params: { operation: "cancel", transferId }, timeoutMs: 2_000,
    }), AbortSignal.timeout(2_000));
    if (!result.success) return result.error?.message || "Native upload cleanup failed.";
    const data = result.data;
    return data && typeof data === "object" && !Array.isArray(data) && Object.keys(data).length === 2 &&
      (data as Record<string, unknown>).transferId === transferId && (data as Record<string, unknown>).cancelled === true
      ? undefined : "Native upload cleanup returned inconsistent result data.";
  } catch (error) { return error instanceof Error ? error.message : String(error); }
};
const readChunk = async (handle: FileHandle, size: number, offset: number, signal: AbortSignal) => {
  const buffer = Buffer.alloc(size);
  let filled = 0;
  while (filled < size) {
    signal.throwIfAborted();
    const { bytesRead } = await handle.read(buffer, filled, size - filled, offset + filled);
    if (!bytesRead) throw new Error("The upload source ended before its declared size.");
    filled += bytesRead;
  }
  return buffer;
};
const sourceSignature = async (handle: FileHandle, size: number) => {
  const metadata = await handle.stat({ bigint: true });
  if (!metadata.isFile() || metadata.size !== BigInt(size)) throw new Error("The upload source size or type changed during transfer.");
  return `${metadata.dev}:${metadata.ino}:${metadata.size}:${metadata.mtimeNs}:${metadata.ctimeNs}`;
};
export const uploadSource = async (client: RelayClient, source: UploadSource, signal: AbortSignal, onChunk?: (bytes: number) => void | Promise<void>) => {
  const transferId = randomUUID();
  const totalChunks = Math.ceil(source.size / UPLOAD_CHUNK_BYTES);
  const handle = await open(source.path, "r");
  let remoteStarted = false;
  let handleClosed = false;
  try {
    const signature = await sourceSignature(handle, source.size);
    if (signature !== source.signature) throw new Error("The upload source changed after collection.");
    const digest = createHash("sha256");
    remoteStarted = true;
    requireSuccess(await client.execute(createActionRequest({
      action: "uploadFile",
      engine: "native",
      params: {
        operation: "begin", transferId, fileName: basename(source.path), relativePath: source.relativePath,
        ...(source.directoryGroupId ? { directoryGroupId: source.directoryGroupId } : {}), totalChunks, totalBytes: source.size,
      },
    }), signal));
    for (let index = 0, offset = 0; index < totalChunks; index += 1, offset += UPLOAD_CHUNK_BYTES) {
      signal.throwIfAborted();
      const buffer = await readChunk(handle, Math.min(UPLOAD_CHUNK_BYTES, source.size - offset), offset, signal);
      if (await sourceSignature(handle, source.size) !== signature) throw new Error("The upload source changed during transfer.");
      digest.update(buffer);
      requireSuccess(await client.execute(createActionRequest({
        action: "uploadFile",
        engine: "native",
        params: { operation: "chunk", transferId, chunkIndex: index, chunkBase64: buffer.toString("base64") },
      }), signal));
      await onChunk?.(buffer.length);
    }
    if (await sourceSignature(handle, source.size) !== signature) throw new Error("The upload source changed during transfer.");
    const expectedSha256 = digest.digest("hex");
    await handle.close();
    handleClosed = true;
    signal.throwIfAborted();
    const completed = requireSuccess(await client.execute(createActionRequest({
      action: "uploadFile", engine: "native", params: { operation: "end", transferId, expectedSha256 },
    }), signal));
    if (completed.transferId !== transferId || completed.complete !== true || completed.sha256 !== expectedSha256 ||
      completed.bytes !== source.size || completed.nextChunk !== totalChunks ||
      typeof completed.path !== "string" || !completed.path)
      throw new Error("The uploaded file returned inconsistent completion metadata.");
    return { transferId, path: completed.path, sha256: expectedSha256 };
  } catch (error) {
    if (!handleClosed) await handle.close().catch(() => undefined);
    const cleanupFailure = remoteStarted ? await cancelRemote(client, transferId) : undefined;
    if (cleanupFailure) throw exposeCleanupFailure(error, { transferId, message: cleanupFailure });
    throw error;
  }
};
