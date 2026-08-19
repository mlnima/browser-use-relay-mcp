import type { FileHandle } from "node:fs/promises";
import { MAX_DOWNLOAD_SESSIONS, MAX_DOWNLOAD_SESSIONS_PER_OWNER, UPLOAD_LEASE_TIMEOUT_MS } from "./constants.js";
import { createNativeError } from "./nativeError.js";
import { openDownloadFile } from "./openDownloadFile.js";

export type DownloadSession = {
  id: string;
  owner: object;
  path: string;
  chunkSize: number;
  size: number;
  signature: string;
  file: FileHandle;
  lease?: NodeJS.Timeout;
  closed?: boolean;
};
const sessions = new Map<object, Map<string, DownloadSession>>();
const assertSessionCapacity = (owner: object) => {
  const ownerCount = sessions.get(owner)?.size || 0;
  let globalCount = 0;
  for (const owned of sessions.values()) globalCount += owned.size;
  if (ownerCount >= MAX_DOWNLOAD_SESSIONS_PER_OWNER)
    throw createNativeError("DOWNLOAD_SESSION_LIMIT", "The relay client download-session limit has been reached.", true);
  if (globalCount >= MAX_DOWNLOAD_SESSIONS)
    throw createNativeError("DOWNLOAD_SESSION_LIMIT", "The native host download-session limit has been reached.", true);
};
const metadataFor = async (file: FileHandle) => {
  const details = await file.stat({ bigint: true });
  if (!details.isFile()) throw createNativeError("DOWNLOAD_NOT_FILE", "The download path is not a file.");
  const size = Number(details.size);
  if (!Number.isSafeInteger(size))
    throw createNativeError("DOWNLOAD_TOO_LARGE", "The download size exceeds the supported integer range.");
  const signature = `${details.dev}:${details.ino}:${details.size}:${details.mtimeNs}:${details.ctimeNs}`;
  return { size, signature };
};
const ownerSessions = (owner: object) => {
  const current = sessions.get(owner);
  if (current) return current;
  const created = new Map<string, DownloadSession>();
  sessions.set(owner, created);
  return created;
};
const closeSession = async (state: DownloadSession) => {
  if (state.closed) return;
  state.closed = true;
  if (state.lease) clearTimeout(state.lease);
  state.lease = undefined;
  const owned = sessions.get(state.owner);
  if (owned?.get(state.id) === state) owned.delete(state.id);
  if (owned && !owned.size) sessions.delete(state.owner);
  await state.file.close();
};
export const touchDownloadSession = (state: DownloadSession) => {
  if (state.closed) throw createNativeError("TRANSFER_NOT_FOUND", `Download transfer "${state.id}" is no longer active.`);
  if (state.lease) clearTimeout(state.lease);
  const lease = setTimeout(() => void closeSession(state).catch(() => undefined), UPLOAD_LEASE_TIMEOUT_MS);
  lease.unref();
  state.lease = lease;
};
export const getDownloadSession = async (owner: object, id: string, path: string, chunkSize: number) => {
  const current = sessions.get(owner)?.get(id);
  if (current) {
    if (current.path !== path || current.chunkSize !== chunkSize)
      throw createNativeError("TRANSFER_METADATA_CONFLICT", `Download transfer "${id}" changed path or chunk size.`);
    touchDownloadSession(current);
    return current;
  }
  assertSessionCapacity(owner);
  const file = await openDownloadFile(path);
  try {
    const metadata = await metadataFor(file);
    const state: DownloadSession = { id, owner, path, chunkSize, file, ...metadata };
    ownerSessions(owner).set(id, state);
    touchDownloadSession(state);
    return state;
  } catch (error) {
    await file.close().catch(() => undefined);
    throw error;
  }
};

export const assertDownloadStable = async (state: DownloadSession) => {
  const current = await metadataFor(state.file);
  if (current.size !== state.size || current.signature !== state.signature)
    throw createNativeError("DOWNLOAD_SOURCE_CHANGED", "The download source changed during transfer.");
  touchDownloadSession(state);
};
export const finishDownloadSession = (state: DownloadSession) => closeSession(state);
export const cancelDownloadSession = async (owner: object, id: string) => {
  const state = sessions.get(owner)?.get(id);
  if (state) await closeSession(state);
};
export const cancelDownloadsByOwner = async (owner: object) => {
  const owned = [...(sessions.get(owner)?.values() || [])];
  await Promise.allSettled(owned.map(closeSession));
};
export const cleanupDownloads = async () => {
  const active = [...sessions.values()].flatMap((owned) => [...owned.values()]);
  await Promise.allSettled(active.map(closeSession));
};
