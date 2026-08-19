import { appendFile, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createNativeError } from "./nativeError.js";
import { decodeTransferChunk } from "./decodeTransferChunk.js";
import { touchUpload, uploadStateFor } from "./uploadAccess.js";
import { getUploadRoot, uploads } from "./uploadRegistry.js";
import type { UploadState } from "./uploadState.js";
import { prepareUploadTarget } from "./prepareUploadTarget.js";
import { assertUploadAdmission, assertUploadGrowth } from "./uploadCapacity.js";
import { touchUploadGroup } from "./touchUploadGroup.js";

const chunkHash = (chunk: Buffer) => createHash("sha256").update(chunk).digest("hex");
export const startUpload = async (
  id: string,
  name: string,
  totalChunks: number,
  owner: object,
  totalBytes?: number,
  mimeType?: string,
  relativePath?: string,
  directoryGroupId?: string,
) => {
  const current = uploads.get(id);
  const fileName = name;
  if (!fileName) throw createNativeError("INVALID_FILE_NAME", "A file name is required.");
  if (directoryGroupId && (!relativePath || !relativePath.includes("/")))
    throw createNativeError("INVALID_DIRECTORY_GROUP", "Directory-group uploads require a nested relative path.");
  if (current) {
    uploadStateFor(id, owner);
    const matches = current.declaredName === fileName && current.totalChunks === totalChunks &&
      current.totalBytes === totalBytes && current.mimeType === mimeType &&
      current.declaredRelativePath === relativePath && current.directoryGroupId === directoryGroupId;
    if (!matches)
      throw createNativeError("TRANSFER_METADATA_CONFLICT", `Upload transfer "${id}" was restarted with different metadata.`);
    touchUpload(id, current);
    touchUploadGroup(current.directoryGroupId, owner);
    return current;
  }
  assertUploadAdmission(owner, totalBytes, totalChunks);
  const target = await prepareUploadTarget(
    await getUploadRoot(), fileName, relativePath, directoryGroupId, owner,
  );
  const state: UploadState = {
    ...target, declaredName: fileName, declaredRelativePath: relativePath,
    directoryGroupId, nextChunk: 0, totalChunks, totalBytes, mimeType, bytes: 0,
    hashes: [], hash: createHash("sha256"), owner, complete: false,
  };
  uploads.set(id, state);
  touchUpload(id, state);
  touchUploadGroup(directoryGroupId, owner);
  return state;
};

export const appendUploadChunk = async (id: string, index: number, encoded: string, owner: object) => {
  const state = uploadStateFor(id, owner);
  touchUpload(id, state);
  const chunk = decodeTransferChunk(encoded);
  if (index < 0) throw createNativeError("INVALID_TRANSFER_CHUNK", "Transfer chunk indexes cannot be negative.");
  if (state.totalChunks !== undefined && index >= state.totalChunks)
    throw createNativeError("TRANSFER_CHUNK_OUT_OF_RANGE", "The transfer chunk exceeded the declared count.");
  const hash = chunkHash(chunk);
  if (index < state.nextChunk) {
    if (state.hashes[index] !== hash) throw createNativeError("TRANSFER_CHUNK_CONFLICT", "A retried transfer chunk did not match.");
    touchUploadGroup(state.directoryGroupId, owner);
    return state;
  }
  if (index !== state.nextChunk)
    throw createNativeError("TRANSFER_CHUNK_OUT_OF_ORDER", `Expected chunk ${state.nextChunk}, received ${index}.`, true);
  const nextBytes = state.bytes + chunk.length;
  if (state.totalBytes !== undefined && nextBytes > state.totalBytes)
    throw createNativeError("TRANSFER_SIZE_MISMATCH", "The transfer exceeded its declared byte size.");
  assertUploadGrowth(state, nextBytes);
  await appendFile(state.path, chunk);
  if (uploads.get(id) !== state) {
    await unlink(state.path).catch(() => undefined);
    throw createNativeError("TRANSFER_NOT_FOUND", `Upload transfer "${id}" is no longer active.`);
  }
  state.hashes.push(hash);
  state.hash.update(chunk);
  state.nextChunk += 1;
  state.bytes += chunk.length;
  touchUploadGroup(state.directoryGroupId, owner);
  return state;
};
