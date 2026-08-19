import { platform } from "node:os";
import { isAbsolute, join } from "node:path";
import { randomUUID } from "node:crypto";
import { createNativeError } from "./nativeError.js";
import { prepareTransferParent } from "./transferPathClaims.js";

const hostPlatform = platform();
const invalidCharacter = /[\/\u0000]/;
const windowsInvalidCharacter = /[<>:"\\|?*\u0000-\u001f]/;
const unpairedSurrogate = /(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])/;
const windowsReservedName = /^(con|prn|aux|nul|clock\$|conin\$|conout\$|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i;
const validateSegment = (segment: string) => {
  if (!segment || [".", ".."].includes(segment))
    throw createNativeError("INVALID_FILE_NAME", "Upload paths cannot contain empty, current, or parent segments.");
  if (invalidCharacter.test(segment) || unpairedSurrogate.test(segment))
    throw createNativeError("INVALID_FILE_NAME", "Upload names contain a slash, NUL, or unpaired Unicode surrogate.");
  if (hostPlatform === "win32" && (windowsInvalidCharacter.test(segment) || /[. ]$/.test(segment) ||
    windowsReservedName.test(segment)))
    throw createNativeError("INVALID_FILE_NAME", "The upload name is not valid on this Windows host.");
  const tooLong = hostPlatform === "linux" ? Buffer.byteLength(segment) > 255 : segment.length > 255;
  if (tooLong) throw createNativeError("INVALID_FILE_NAME", "The upload name exceeds the host filesystem component limit.");
  return segment;
};
export const createUploadPath = async (
  root: string,
  fileName: string,
  relativePath?: string,
  directoryNamespace?: () => string,
) => {
  const validFileName = validateSegment(fileName);
  if (relativePath !== undefined && !relativePath)
    throw createNativeError("INVALID_RELATIVE_PATH", "Relative upload paths cannot be empty.");
  if (relativePath && isAbsolute(relativePath))
    throw createNativeError("INVALID_RELATIVE_PATH", "Relative upload paths cannot be absolute on this host.");
  const segments = relativePath === undefined ? [validFileName] : relativePath.split("/").map(validateSegment);
  if (segments.at(-1) !== validFileName)
    throw createNativeError("INVALID_FILE_NAME", "The file name must exactly match the final relative-path segment.");
  const grouped = segments.length > 1;
  const namespace = grouped ? directoryNamespace?.() || randomUUID() : randomUUID();
  const path = join(root, namespace, ...segments);
  const claimPaths = await prepareTransferParent(
    root, namespace, segments, grouped && directoryNamespace !== undefined,
  );
  return {
    path,
    fileName: validFileName,
    claimPaths,
    ...(relativePath === undefined ? {} : { relativePath }),
    directoryRoot: grouped ? join(root, namespace, segments[0] || "") : undefined,
  };
};
