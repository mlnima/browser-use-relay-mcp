import { COMPLETED_UPLOAD_RETENTION_MS } from "./constants.js";
import { createNativeError } from "./nativeError.js";
import { expireUpload } from "./uploadCleanup.js";
import { uploadStateFor } from "./uploadAccess.js";
import { clearUploadLease, refreshUploadLease } from "./uploadLease.js";
import { touchUploadGroup } from "./touchUploadGroup.js";

export const finishUpload = (id: string, owner: object, expectedSha256: string) => {
  const state = uploadStateFor(id, owner);
  if (!/^[a-f\d]{64}$/i.test(expectedSha256))
    throw createNativeError("INVALID_TRANSFER_HASH", "The expected upload SHA-256 must contain 64 hexadecimal characters.");
  if (state.totalChunks !== undefined && state.nextChunk !== state.totalChunks)
    throw createNativeError("TRANSFER_INCOMPLETE", `Expected ${state.totalChunks} chunks, received ${state.nextChunk}.`, true);
  if (state.totalBytes !== undefined && state.bytes !== state.totalBytes)
    throw createNativeError("TRANSFER_SIZE_MISMATCH", `Expected ${state.totalBytes} bytes, received ${state.bytes}.`);
  state.digest ||= state.hash.digest("hex");
  if (state.digest !== expectedSha256.toLowerCase())
    throw createNativeError("TRANSFER_HASH_MISMATCH", "The staged upload did not match its expected SHA-256.");
  if (state.directoryGroupId) {
    const assemblyLease = touchUploadGroup(state.directoryGroupId, owner);
    state.complete = true;
    if (assemblyLease !== undefined) clearUploadLease(state);
  } else {
    state.complete = true;
    state.retentionDeadline ||= Date.now() + COMPLETED_UPLOAD_RETENTION_MS;
    refreshUploadLease(state, () => expireUpload(id, state), Math.max(0, state.retentionDeadline - Date.now()));
  }
  return state;
};
