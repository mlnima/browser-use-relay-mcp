import {
  MAX_STAGED_UPLOAD_BYTES, MAX_STAGED_UPLOAD_BYTES_PER_OWNER,
  MAX_UPLOAD_CHUNKS, MAX_UPLOAD_CHUNKS_PER_OWNER, MAX_UPLOAD_CHUNKS_PER_SESSION,
  MAX_UPLOAD_SESSIONS, MAX_UPLOAD_SESSIONS_PER_OWNER,
} from "./constants.js";
import { createNativeError } from "./nativeError.js";
import { uploads } from "./uploadRegistry.js";
import type { UploadState } from "./uploadState.js";

const reservedBytes = (state: UploadState) => Math.max(state.bytes, state.totalBytes ?? 0);
const usageFor = (owner: object) => {
  let globalBytes = 0;
  let ownerBytes = 0;
  let ownerSessions = 0;
  let globalChunks = 0;
  let ownerChunks = 0;
  for (const state of uploads.values()) {
    const bytes = reservedBytes(state);
    globalBytes += bytes;
    globalChunks += state.totalChunks || 0;
    if (state.owner === owner) {
      ownerBytes += bytes;
      ownerSessions += 1;
      ownerChunks += state.totalChunks || 0;
    }
  }
  return { globalBytes, ownerBytes, ownerSessions, globalChunks, ownerChunks };
};
const assertBytes = (owner: object, additional: number) => {
  const usage = usageFor(owner);
  if (usage.ownerBytes + additional > MAX_STAGED_UPLOAD_BYTES_PER_OWNER)
    throw createNativeError("UPLOAD_BYTE_LIMIT", "The relay client staged-upload byte limit has been reached.", true);
  if (usage.globalBytes + additional > MAX_STAGED_UPLOAD_BYTES)
    throw createNativeError("UPLOAD_BYTE_LIMIT", "The native host staged-upload byte limit has been reached.", true);
};

export const assertUploadAdmission = (owner: object, totalBytes: number | undefined, totalChunks: number) => {
  const usage = usageFor(owner);
  if (usage.ownerSessions >= MAX_UPLOAD_SESSIONS_PER_OWNER)
    throw createNativeError("UPLOAD_SESSION_LIMIT", "The relay client upload-session limit has been reached.", true);
  if (uploads.size >= MAX_UPLOAD_SESSIONS)
    throw createNativeError("UPLOAD_SESSION_LIMIT", "The native host upload-session limit has been reached.", true);
  if (totalChunks > MAX_UPLOAD_CHUNKS_PER_SESSION)
    throw createNativeError("UPLOAD_CHUNK_LIMIT", "The upload exceeds the per-file chunk-count limit.");
  if (usage.ownerChunks + totalChunks > MAX_UPLOAD_CHUNKS_PER_OWNER)
    throw createNativeError("UPLOAD_CHUNK_LIMIT", "The relay client upload chunk-count limit has been reached.", true);
  if (usage.globalChunks + totalChunks > MAX_UPLOAD_CHUNKS)
    throw createNativeError("UPLOAD_CHUNK_LIMIT", "The native host upload chunk-count limit has been reached.", true);
  if (totalBytes !== undefined && totalBytes > MAX_STAGED_UPLOAD_BYTES_PER_OWNER)
    throw createNativeError("UPLOAD_SIZE_LIMIT", "The upload exceeds the per-client staged-file size limit.");
  assertBytes(owner, totalBytes ?? 0);
};
export const assertUploadGrowth = (state: UploadState, nextBytes: number) =>
  assertBytes(state.owner, Math.max(nextBytes, state.totalBytes ?? 0) - reservedBytes(state));
