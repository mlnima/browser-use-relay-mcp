import type { JsonValue } from "../types/json.js";
import { COMPLETED_UPLOAD_RETENTION_MS } from "./constants.js";
import { createNativeError } from "./nativeError.js";
import { expireUpload } from "./uploadCleanup.js";
import { assertDirectoryGroupOwner, finalizeDirectoryGroup } from "./uploadDirectoryGroups.js";
import { refreshUploadLease } from "./uploadLease.js";
import { uploads } from "./uploadRegistry.js";

export const finalizeUploadGroup = (id: string, owner: object): JsonValue => {
  assertDirectoryGroupOwner(id, owner);
  const members = [...uploads].filter(([, state]) => state.directoryGroupId === id && state.owner === owner);
  if (!members.length) throw createNativeError("TRANSFER_NOT_FOUND", `Directory group "${id}" has no staged files.`);
  if (members.some(([, state]) => state.retiring || !state.complete))
    throw createNativeError("DIRECTORY_GROUP_INCOMPLETE", `Directory group "${id}" has incomplete staged files.`, true);
  const roots = new Set(members.map(([, state]) => state.directoryRoot).filter(Boolean));
  if (roots.size !== 1)
    throw createNativeError("DIRECTORY_GROUP_ROOT_CONFLICT", `Directory group "${id}" does not have one directory root.`);
  const firstFinalization = finalizeDirectoryGroup(id, owner, members.length);
  const deadline = Date.now() + COMPLETED_UPLOAD_RETENTION_MS;
  for (const [transferId, state] of members) {
    state.directoryReady = true;
    if (firstFinalization) {
      state.retentionDeadline = deadline;
      refreshUploadLease(state, () => expireUpload(transferId, state), COMPLETED_UPLOAD_RETENTION_MS);
    }
  }
  return { directoryGroupId: id, directoryRoot: [...roots][0] || "", files: members.length, complete: true };
};
