import { randomUUID } from "node:crypto";
import { createNativeError } from "./nativeError.js";
import { releaseTransferNamespace } from "./transferPathClaims.js";
import { DIRECTORY_GROUP_ASSEMBLY_RETENTION_MS, DIRECTORY_GROUP_MAX_ASSEMBLY_MS } from "./constants.js";
type DirectoryGroup = {
  namespace: string; owner: object; members: number; finalized: boolean; invalidated: boolean; hardDeadline: number; lease?: NodeJS.Timeout;
};
const groups = new Map<string, DirectoryGroup>();
const releaseIfEmpty = (id: string, group: DirectoryGroup) => {
  if (group.members || groups.get(id) !== group) return;
  if (group.lease) clearTimeout(group.lease);
  releaseTransferNamespace(group.namespace);
  groups.delete(id);
};
export const directoryNamespace = (id: string, owner: object) => {
  if (!id || id.length > 256)
    throw createNativeError("INVALID_DIRECTORY_GROUP", "Directory group ids must contain 1 to 256 characters.");
  const current = groups.get(id);
  if (current && current.owner !== owner)
    throw createNativeError("TRANSFER_OWNERSHIP_CONFLICT", `Directory group "${id}" belongs to another relay client.`);
  if (current?.invalidated)
    throw createNativeError("DIRECTORY_GROUP_INCOMPLETE", `Directory group "${id}" lost a staged member.`);
  if (current && !current.finalized && Date.now() >= current.hardDeadline) {
    current.invalidated = true;
    throw createNativeError("DIRECTORY_GROUP_EXPIRED", `Directory group "${id}" exceeded its assembly duration.`);
  }
  if (current?.finalized)
    throw createNativeError("DIRECTORY_GROUP_FINALIZED", `Directory group "${id}" is already finalized.`);
  if (current) return current.namespace;
  const namespace = randomUUID();
  groups.set(id, {
    namespace, owner, members: 0, finalized: false, invalidated: false,
    hardDeadline: Date.now() + DIRECTORY_GROUP_MAX_ASSEMBLY_MS,
  });
  return namespace;
};
export const retainDirectoryGroup = (id: string | undefined, owner: object) => {
  if (!id) return;
  const group = groups.get(id);
  if (!group || group.owner !== owner)
    throw createNativeError("TRANSFER_OWNERSHIP_CONFLICT", `Directory group "${id}" is unavailable.`);
  group.members += 1;
};
export const abandonDirectoryGroup = (id: string | undefined, owner: object) => {
  const group = id ? groups.get(id) : undefined;
  if (group?.owner === owner) releaseIfEmpty(id!, group);
};
export const releaseDirectoryGroup = (id: string | undefined, owner: object) => {
  const group = id ? groups.get(id) : undefined;
  if (!group || group.owner !== owner) return;
  group.invalidated = true;
  if (group.members > 0) group.members -= 1;
  releaseIfEmpty(id!, group);
};
export const assertDirectoryGroupOwner = (id: string, owner: object) => {
  const group = groups.get(id);
  if (!group) throw createNativeError("TRANSFER_NOT_FOUND", `Directory group "${id}" was not started.`);
  if (group.owner !== owner)
    throw createNativeError("TRANSFER_OWNERSHIP_CONFLICT", `Directory group "${id}" belongs to another relay client.`);
  return group;
};
export const touchDirectoryGroup = (id: string, owner: object, expire: () => void) => {
  const group = assertDirectoryGroupOwner(id, owner);
  if (group.finalized) return undefined;
  if (group.invalidated || Date.now() >= group.hardDeadline) {
    group.invalidated = true;
    throw createNativeError("DIRECTORY_GROUP_EXPIRED", `Directory group "${id}" exceeded its assembly duration.`);
  }
  const duration = Math.max(0, Math.min(
    group.hardDeadline, Date.now() + DIRECTORY_GROUP_ASSEMBLY_RETENTION_MS,
  ) - Date.now());
  if (group.lease) clearTimeout(group.lease);
  const lease = setTimeout(() => {
    if (group.lease !== lease) return;
    group.lease = undefined;
    expire();
  }, duration);
  lease.unref();
  group.lease = lease;
  return duration;
};
export const finalizeDirectoryGroup = (id: string, owner: object, members: number) => {
  const group = assertDirectoryGroupOwner(id, owner);
  if (group.invalidated || group.members !== members)
    throw createNativeError("DIRECTORY_GROUP_INCOMPLETE", `Directory group "${id}" lost a staged member.`);
  if (group.finalized) return false;
  group.finalized = true;
  if (group.lease) clearTimeout(group.lease);
  group.lease = undefined;
  return true;
};
export const releaseDirectoryGroupsByOwner = (owner: object) => {
  for (const [id, group] of groups) if (group.owner === owner) releaseIfEmpty(id, group);
};
export const clearDirectoryGroups = () => {
  for (const group of groups.values()) {
    if (group.lease) clearTimeout(group.lease); releaseTransferNamespace(group.namespace);
  }
  groups.clear();
};
