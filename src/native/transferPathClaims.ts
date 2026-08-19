import { lstat, mkdir, rmdir } from "node:fs/promises";
import { join } from "node:path";
import { createNativeError } from "./nativeError.js";

const namespaceClaims = new Map<string, Set<string>>();
const claimOwners = new Map<string, string>();
const exists = async (path: string) => {
  try { await lstat(path); return true; } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
};
const unclaim = (namespace: string, path: string) => {
  const claims = namespaceClaims.get(namespace);
  claims?.delete(path);
  claimOwners.delete(path);
  if (!claims?.size) namespaceClaims.delete(namespace);
};
const claim = async (namespace: string, path: string, reusable: boolean) => {
  const claims = namespaceClaims.get(namespace) || new Set<string>();
  if (claims.has(path)) {
    if (reusable) return false;
    throw createNativeError("TRANSFER_PATH_CONFLICT", "The directory group already contains this upload path.");
  }
  if (await exists(path))
    throw createNativeError("TRANSFER_PATH_CONFLICT", "The host filesystem maps distinct upload names to the same path.");
  claims.add(path);
  namespaceClaims.set(namespace, claims);
  claimOwners.set(path, namespace);
  return true;
};
export const prepareTransferParent = async (
  root: string,
  namespace: string,
  segments: string[],
  grouped: boolean,
) => {
  const added: string[] = [];
  const createdDirectories: string[] = [];
  let parent = root;
  await mkdir(root, { recursive: true });
  try {
    for (const [index, segment] of [namespace, ...segments].entries()) {
      const candidate = join(parent, segment);
      const directory = index < segments.length;
      const claimed = grouped ? await claim(namespace, candidate, directory) : false;
      if (claimed) added.push(candidate);
      if (directory && await mkdir(candidate, { recursive: true })) createdDirectories.push(candidate);
      parent = candidate;
    }
    return added;
  } catch (error) {
    for (const path of createdDirectories.reverse()) await rmdir(path).catch(() => undefined);
    for (const path of added.reverse()) unclaim(namespace, path);
    throw error;
  }
};
export const releaseTransferPathClaim = (path: string) => {
  const namespace = claimOwners.get(path);
  if (namespace) unclaim(namespace, path);
};
export const releaseTransferPathClaims = (paths: string[]) => {
  for (const path of paths) releaseTransferPathClaim(path);
};
export const releaseTransferNamespace = (namespace: string) => {
  for (const path of namespaceClaims.get(namespace) || []) claimOwners.delete(path);
  namespaceClaims.delete(namespace);
};
