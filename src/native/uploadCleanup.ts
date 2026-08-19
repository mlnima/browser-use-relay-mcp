import { unlink } from "node:fs/promises";
import { createNativeError } from "./nativeError.js";
import { pruneUploadDirectories } from "./pruneUploadDirectories.js";
import { clearDirectoryGroups, releaseDirectoryGroup, releaseDirectoryGroupsByOwner } from "./uploadDirectoryGroups.js";
import { clearUploadLease, refreshUploadLease } from "./uploadLease.js";
import { currentUploadRoot, resetUploadRegistry, uploads } from "./uploadRegistry.js";
import type { UploadState } from "./uploadState.js";
import { removeStagingRoot } from "./stagingRoots.js";
import { releaseTransferPathClaim } from "./transferPathClaims.js";

const removeUpload = async (id: string, state: UploadState) => {
  clearUploadLease(state);
  try {
    await unlink(state.path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  releaseTransferPathClaim(state.path);
  await pruneUploadDirectories(state.path, currentUploadRoot());
  releaseDirectoryGroup(state.directoryGroupId, state.owner);
  if (uploads.get(id) === state) uploads.delete(id);
};

export const expireUpload = (id: string, state: UploadState) => {
  if (uploads.get(id) !== state) return;
  state.retiring = true;
  void removeUpload(id, state).catch(() => {
    if (uploads.get(id) === state) refreshUploadLease(state, () => expireUpload(id, state));
  });
};

export const cancelUpload = async (id: string, owner?: object) => {
  const state = uploads.get(id);
  if (!state) return false;
  if (owner && state.owner !== owner)
    throw createNativeError("TRANSFER_OWNERSHIP_CONFLICT", `Upload transfer "${id}" belongs to another relay client.`);
  state.retiring = true;
  try {
    await removeUpload(id, state);
    return true;
  } catch (error) {
    if (uploads.get(id) === state) refreshUploadLease(state, () => expireUpload(id, state));
    throw error;
  }
};

export const cancelUploadsByOwner = async (owner: object) => {
  const ids = [...uploads].filter(([, state]) => state.owner === owner).map(([id]) => id);
  await Promise.allSettled(ids.map((id) => cancelUpload(id, owner)));
  releaseDirectoryGroupsByOwner(owner);
};

export const cleanupUploads = async () => {
  for (const state of uploads.values()) clearUploadLease(state);
  const root = resetUploadRegistry();
  clearDirectoryGroups();
  if (root) await removeStagingRoot(root);
};
