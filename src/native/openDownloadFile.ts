import { constants, type BigIntStats } from "node:fs";
import { lstat, open, type FileHandle } from "node:fs/promises";
import { createNativeError } from "./nativeError.js";

const windowsDeviceNames = new Set([
  "aux", "clock$", "con", "conin$", "conout$", "nul", "prn",
  ...Array.from({ length: 9 }, (_, index) => `com${index + 1}`),
  ...Array.from({ length: 9 }, (_, index) => `lpt${index + 1}`),
  "com¹", "com²", "com³", "lpt¹", "lpt²", "lpt³",
]);
const unsafeWindowsPath = (path: string) => {
  const normalized = path.replaceAll("/", "\\");
  const upper = normalized.toUpperCase();
  if (upper.startsWith("\\\\.\\") || upper.startsWith("\\\\?\\GLOBALROOT\\") ||
    upper.startsWith("\\??\\") || /^\\\\(?:\?\\UNC\\)?[^\\]+\\PIPE(?:\\|$)/i.test(normalized)) return true;
  if (upper.startsWith("\\\\?\\") && !/^\\\\\?\\(?:[A-Z]:\\|UNC\\[^\\]+\\[^\\]+\\)/i.test(normalized)) return true;
  return normalized.split("\\").some((segment) => {
    const base = segment.split(/[.:]/, 1)[0]?.trimEnd().toLowerCase();
    return !!base && windowsDeviceNames.has(base);
  });
};
const sameIdentity = (
  before: BigIntStats,
  after: BigIntStats,
) => before.dev === after.dev && before.ino === after.ino && before.size === after.size &&
  before.mtimeNs === after.mtimeNs && before.ctimeNs === after.ctimeNs;

export const openDownloadFile = async (path: string) => {
  if (process.platform === "win32" && unsafeWindowsPath(path))
    throw createNativeError("DOWNLOAD_UNSAFE_PATH", "Windows device and named-pipe paths cannot be downloaded.");
  const before = await lstat(path, { bigint: true });
  if (before.isSymbolicLink())
    throw createNativeError("DOWNLOAD_UNSAFE_PATH", "Symbolic-link download paths are not supported.");
  if (!before.isFile()) throw createNativeError("DOWNLOAD_NOT_FILE", "The download path is not a regular file.");
  const flags = process.platform === "win32" ? constants.O_RDONLY :
    constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW;
  let file: FileHandle | undefined;
  try {
    file = await open(path, flags);
    const after = await file.stat({ bigint: true });
    if (!after.isFile()) throw createNativeError("DOWNLOAD_NOT_FILE", "The download path is not a regular file.");
    if (!sameIdentity(before, after))
      throw createNativeError("DOWNLOAD_SOURCE_CHANGED", "The download source changed while it was opened.");
    return file;
  } catch (error) {
    await file?.close().catch(() => undefined);
    throw error;
  }
};
