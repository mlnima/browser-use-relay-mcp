import { randomUUID } from "node:crypto";
import { lstat, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { PACKAGE_NAME } from "../protocol/version.js";
import { STAGING_ROOT_STALE_MS } from "./constants.js";
import { createNativeError } from "./nativeError.js";

type OwnerMarker = { pid: number; startedAt: number; identity: string };
const prefix = `${PACKAGE_NAME}-`;
const markerName = ".owner.json";
const tempRoot = resolve(tmpdir());
const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const rootPattern = new RegExp(`^${escapedPrefix}[A-Za-z0-9]{6}$`);
const hostIdentity = randomUUID();
const processStartedAt = Date.now() - Math.round(process.uptime() * 1000);
let scavenging: Promise<void> | undefined;

const validRoot = (path: string) => dirname(resolve(path)) === tempRoot && rootPattern.test(basename(path));
const readOwner = async (root: string) => {
  try {
    const value = JSON.parse(await readFile(join(root, markerName), "utf8")) as Partial<OwnerMarker>;
    if (Number.isSafeInteger(value.pid) && (value.pid || 0) > 0 && typeof value.startedAt === "number" &&
      Number.isFinite(value.startedAt) && (value.startedAt || 0) > 0 && typeof value.identity === "string" && value.identity)
      return value as OwnerMarker;
  } catch {
    return undefined;
  }
  return undefined;
};
const ownerAlive = (owner: OwnerMarker) => {
  try {
    process.kill(owner.pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
};
const staleRoot = async (root: string) => {
  const details = await lstat(root);
  if (!details.isDirectory() || details.isSymbolicLink() || Date.now() - details.mtimeMs < STAGING_ROOT_STALE_MS)
    return false;
  const owner = await readOwner(root);
  return !owner || !ownerAlive(owner);
};

export const removeStagingRoot = async (root: string) => {
  if (!validRoot(root)) throw createNativeError("INVALID_STAGING_ROOT", "The staging root failed its temporary-directory boundary check.");
  await rm(root, { recursive: true, force: true });
};
const scavenge = async () => {
  const entries = await readdir(tempRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || !rootPattern.test(entry.name)) continue;
    const root = join(tempRoot, entry.name);
    try {
      if (await staleRoot(root)) await removeStagingRoot(root);
    } catch {}
  }
};
const scavengeOnce = () => {
  if (scavenging) return scavenging;
  const task = scavenge();
  scavenging = task;
  void task.catch(() => { if (scavenging === task) scavenging = undefined; });
  return task;
};

export const createStagingRoot = async () => {
  await scavengeOnce();
  const root = await mkdtemp(join(tempRoot, prefix));
  try {
    const owner: OwnerMarker = { pid: process.pid, startedAt: processStartedAt, identity: hostIdentity };
    await writeFile(join(root, markerName), JSON.stringify(owner), { flag: "wx", mode: 0o600 });
    return root;
  } catch (error) {
    await removeStagingRoot(root).catch(() => undefined);
    throw error;
  }
};
