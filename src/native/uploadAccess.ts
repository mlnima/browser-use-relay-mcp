import { createNativeError } from "./nativeError.js";
import { expireUpload } from "./uploadCleanup.js";
import { refreshUploadLease } from "./uploadLease.js";
import { uploads } from "./uploadRegistry.js";
import type { UploadState } from "./uploadState.js";

export const uploadStateFor = (id: string, owner: object) => {
  const state = uploads.get(id);
  if (!state) throw createNativeError("TRANSFER_NOT_FOUND", `Upload transfer "${id}" was not started.`);
  if (state.retiring) throw createNativeError("TRANSFER_NOT_FOUND", `Upload transfer "${id}" is being removed.`);
  if (state.owner !== owner)
    throw createNativeError("TRANSFER_OWNERSHIP_CONFLICT", `Upload transfer "${id}" belongs to another relay client.`);
  return state;
};

export const touchUpload = (id: string, state: UploadState) => {
  if (!state.complete) refreshUploadLease(state, () => expireUpload(id, state));
};
