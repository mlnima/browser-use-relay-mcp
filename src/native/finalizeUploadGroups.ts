import type { JsonValue } from "../types/json.js";
import { COMPLETED_UPLOAD_RETENTION_MS } from "./constants.js";
import { createNativeError } from "./nativeError.js";
import { expireUpload } from "./uploadCleanup.js";
import { assertDirectoryGroupOwner, finalizeDirectoryGroup } from "./uploadDirectoryGroups.js";
import { refreshUploadLease } from "./uploadLease.js";
import { uploads } from "./uploadRegistry.js";
import type { UploadState } from "./uploadState.js";
import type { FinalizeUploadGroupInput } from "./readFinalizeUploadGroups.js";

type Member = [string, UploadState];
type Prepared = { input: FinalizeUploadGroupInput; members: Member[]; root: string; finalized: boolean };
const invalid = (code: string, message: string): never => { throw createNativeError(code, message); };

export const finalizeUploadGroups = (inputs: FinalizeUploadGroupInput[], owner: object): JsonValue => {
  const requested = new Set(inputs.map(({ directoryGroupId }) => directoryGroupId));
  const grouped = new Map(inputs.map(({ directoryGroupId }) => [directoryGroupId, [] as Member[]]));
  for (const member of uploads) {
    const groupId = member[1].directoryGroupId;
    if (member[1].owner === owner && groupId && requested.has(groupId)) grouped.get(groupId)!.push(member);
  }
  const now = Date.now();
  const prepared: Prepared[] = inputs.map((input) => {
    const group = assertDirectoryGroupOwner(input.directoryGroupId, owner);
    const members = grouped.get(input.directoryGroupId)!;
    if (group.invalidated || !group.finalized && now >= group.hardDeadline)
      return invalid("DIRECTORY_GROUP_EXPIRED", "A directory group expired before atomic finalization.");
    if (group.members !== input.expectedFiles || members.length !== input.expectedFiles)
      return invalid("DIRECTORY_GROUP_INCOMPLETE", "A directory group has an unexpected staged-file count.");
    if (members.some(([, state]) => state.retiring || !state.complete || !state.digest || !state.directoryRoot))
      return invalid("DIRECTORY_GROUP_INCOMPLETE", "A directory group contains an incomplete staged file.");
    const roots = new Set(members.map(([, state]) => state.directoryRoot).filter((root): root is string => Boolean(root)));
    if (roots.size !== 1) return invalid("DIRECTORY_GROUP_ROOT_CONFLICT", "A directory group does not have one root.");
    if (group.finalized && members.some(([, state]) => state.directoryReady !== true ||
      !Number.isSafeInteger(state.retentionDeadline)))
      return invalid("DIRECTORY_GROUP_FINALIZATION_CONFLICT", "A finalized directory group has inconsistent state.");
    if (!group.finalized && members.some(([, state]) => state.directoryReady || state.retentionDeadline !== undefined))
      return invalid("DIRECTORY_GROUP_FINALIZATION_CONFLICT", "An unfinalized directory group has inconsistent state.");
    return { input, members, root: [...roots][0]!, finalized: group.finalized };
  });
  const statuses = new Set(prepared.map(({ finalized }) => finalized));
  if (statuses.size !== 1)
    return invalid("DIRECTORY_GROUP_FINALIZATION_CONFLICT", "Bulk finalization cannot mix finalized and unfinalized groups.");
  const alreadyFinalized = prepared[0]!.finalized;
  let retentionDeadline: number;
  if (alreadyFinalized) {
    const deadlines = new Set(prepared.flatMap(({ members }) => members.map(([, state]) => state.retentionDeadline!)));
    retentionDeadline = [...deadlines][0]!;
    if (deadlines.size !== 1 || retentionDeadline <= now)
      return invalid("DIRECTORY_GROUP_FINALIZATION_CONFLICT", "Finalized groups do not share one active retention deadline.");
  } else {
    retentionDeadline = now + COMPLETED_UPLOAD_RETENTION_MS;
    for (const item of prepared) if (!finalizeDirectoryGroup(item.input.directoryGroupId, owner, item.input.expectedFiles))
      return invalid("DIRECTORY_GROUP_FINALIZATION_CONFLICT", "A directory group changed during finalization.");
    for (const { members } of prepared) for (const [transferId, state] of members) {
      state.directoryReady = true;
      state.retentionDeadline = retentionDeadline;
      refreshUploadLease(state, () => expireUpload(transferId, state), Math.max(0, retentionDeadline - Date.now()));
    }
  }
  return {
    groups: prepared.map(({ input, root }) => ({
      directoryGroupId: input.directoryGroupId, directoryRoot: root, files: input.expectedFiles,
    })),
    complete: true,
    retentionDeadline,
  };
};
