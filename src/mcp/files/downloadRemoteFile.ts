import { randomUUID } from "node:crypto";
import { link, mkdir, open, rename, rm, stat, type FileHandle } from "node:fs/promises";
import { dirname } from "node:path";
import type { RelayClient } from "../../types/mcp.js";
import { createActionRequest } from "../createActionRequest.js";
import { DOWNLOAD_CHUNK_BYTES, readDownloadChunk } from "./readDownloadChunk.js";
const exists = async (path: string) => stat(path).then(() => true).catch(() => false);
const removeTemporary = async (path: string) => {
  let failure: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try { await rm(path, { force: true }); return undefined; }
    catch (error) { failure = error; await new Promise((resolve) => setTimeout(resolve, 75 * (attempt + 1))); }
  }
  return failure instanceof Error ? failure.message : "Temporary file cleanup failed.";
};
const writeChunk = async (handle: FileHandle, buffer: Buffer, offset: number, signal: AbortSignal) => {
  let written = 0;
  while (written < buffer.length) {
    signal.throwIfAborted();
    const result = await handle.write(buffer, written, buffer.length - written, offset + written);
    if (!result.bytesWritten) throw new Error("The destination file stopped accepting data.");
    written += result.bytesWritten;
  }
};
const cancelRemote = async (client: RelayClient, transferId: string) => {
  try {
    const result = await client.execute(createActionRequest({
      action: "downloadFile", engine: "native", params: { operation: "cancel", transferId }, timeoutMs: 2_000,
    }), AbortSignal.timeout(2_000));
    if (!result.success) return result.error?.message || "Native download cleanup failed.";
    const data = result.data;
    return data && typeof data === "object" && !Array.isArray(data) && Object.keys(data).length === 2 &&
      (data as Record<string, unknown>).transferId === transferId && (data as Record<string, unknown>).cancelled === true
      ? undefined : "Native download cleanup returned inconsistent result data.";
  } catch (error) { return error instanceof Error ? error.message : String(error); }
};
export const downloadRemoteFile = async (client: RelayClient, remotePath: string, destinationPath: string, overwrite: boolean, signal: AbortSignal) => {
  signal.throwIfAborted();
  if (!overwrite && await exists(destinationPath)) throw new Error(`Destination already exists: ${destinationPath}`);
  await mkdir(dirname(destinationPath), { recursive: true });
  signal.throwIfAborted();
  const temporaryPath = `${destinationPath}.${randomUUID()}.part`;
  const handle = await open(temporaryPath, "wx");
  const transferId = randomUUID();
  let offset = 0;
  let chunkIndex = 0;
  let totalBytes: number | undefined;
  try {
    for (;;) {
      signal.throwIfAborted();
      const result = await client.execute(createActionRequest({
        action: "downloadFile",
        engine: "native",
        params: { operation: "read", path: remotePath, transferId, chunkIndex, offset, chunkSize: DOWNLOAD_CHUNK_BYTES },
      }), signal);
      signal.throwIfAborted();
      if (!result.success) throw new Error(result.error?.message || "Native file read failed.");
      if (!result.data || typeof result.data !== "object" || Array.isArray(result.data))
        throw new Error(`Downloaded chunk ${chunkIndex} returned invalid result data.`);
      const chunk = readDownloadChunk(result.data as Record<string, unknown>, transferId, chunkIndex, offset, totalBytes);
      const { buffer } = chunk;
      totalBytes = chunk.totalBytes;
      await writeChunk(handle, buffer, offset, signal);
      offset += buffer.length;
      chunkIndex += 1;
      if (chunk.complete) break;
    }
    signal.throwIfAborted();
    await handle.close();
    signal.throwIfAborted();
    let cleanupWarning: string | undefined;
    if (overwrite) await rename(temporaryPath, destinationPath);
    else {
      await link(temporaryPath, destinationPath);
      cleanupWarning = await removeTemporary(temporaryPath);
    }
    return { path: destinationPath, bytes: offset, chunks: chunkIndex, ...(cleanupWarning && { cleanupWarning, temporaryPath }) };
  } catch (error) {
    await handle.close().catch(() => undefined);
    const cleanupWarning = await removeTemporary(temporaryPath);
    const remoteCleanup = await cancelRemote(client, transferId);
    if (cleanupWarning || remoteCleanup) {
      const primary = error instanceof Error ? error.message : String(error);
      const local = cleanupWarning ? ` Temporary file cleanup failed at ${temporaryPath}: ${cleanupWarning}.` : "";
      const remote = remoteCleanup ? ` Remote cleanup failed for transfer ${transferId}: ${remoteCleanup}.` : "";
      throw Object.assign(new Error(`${primary}${local}${remote}`, { cause: error }), {
        transferId, cleanupFailure: { local: cleanupWarning, remote: remoteCleanup, temporaryPath },
      });
    }
    throw error;
  }
};
