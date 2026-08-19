import { expireUpload } from "./uploadCleanup.js";
import { touchDirectoryGroup } from "./uploadDirectoryGroups.js";
import { uploads } from "./uploadRegistry.js";

export const touchUploadGroup = (directoryGroupId: string | undefined, owner: object) => {
  if (!directoryGroupId) return;
  return touchDirectoryGroup(directoryGroupId, owner, () => {
    for (const [transferId, state] of uploads) {
      if (state.directoryGroupId === directoryGroupId && state.owner === owner && state.complete && !state.retiring)
        expireUpload(transferId, state);
    }
  });
};
