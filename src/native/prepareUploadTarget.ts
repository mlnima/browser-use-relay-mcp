import { unlink, writeFile } from "node:fs/promises";
import { createNativeError } from "./nativeError.js";
import { pruneUploadDirectories } from "./pruneUploadDirectories.js";
import { createUploadPath } from "./transferPath.js";
import { releaseTransferPathClaims } from "./transferPathClaims.js";
import {
  abandonDirectoryGroup, directoryNamespace, retainDirectoryGroup,
} from "./uploadDirectoryGroups.js";

export const prepareUploadTarget = async (
  root: string,
  fileName: string,
  relativePath: string | undefined,
  directoryGroupId: string | undefined,
  owner: object,
) => {
  let target: Awaited<ReturnType<typeof createUploadPath>> | undefined;
  let created = false;
  try {
    target = await createUploadPath(
      root, fileName, relativePath,
      directoryGroupId === undefined ? undefined : () => directoryNamespace(directoryGroupId, owner),
    );
    await writeFile(target.path, Buffer.alloc(0), { flag: "wx" });
    created = true;
    retainDirectoryGroup(directoryGroupId, owner);
    return {
      path: target.path,
      fileName: target.fileName,
      ...(target.relativePath === undefined ? {} : { relativePath: target.relativePath }),
      ...(target.directoryRoot === undefined ? {} : { directoryRoot: target.directoryRoot }),
    };
  } catch (error) {
    if (created && target) await unlink(target.path).catch(() => undefined);
    if (target) {
      releaseTransferPathClaims(target.claimPaths);
      await pruneUploadDirectories(target.path, root).catch(() => undefined);
    }
    abandonDirectoryGroup(directoryGroupId, owner);
    if ((error as NodeJS.ErrnoException).code === "EEXIST")
      throw createNativeError("TRANSFER_PATH_CONFLICT", "The directory group already contains this relative file path.");
    throw error;
  }
};
