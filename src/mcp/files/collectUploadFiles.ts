import { randomUUID } from "node:crypto";
import { lstat, readdir } from "node:fs/promises";
import { basename, dirname, join, relative, sep } from "node:path";
import { MAX_STAGED_UPLOAD_BYTES_PER_OWNER, MAX_UPLOAD_SESSIONS_PER_OWNER } from "../../protocol/limits.js";

export type UploadSource = { path: string; relativePath: string; size: number; signature: string; directorySource: boolean; directoryGroupId?: string };
type CollectionState = { bytes: number; files: number };
type FileMetadata = { size: bigint; dev: bigint; ino: bigint; mtimeNs: bigint; ctimeNs: bigint };

const addFile = (metadata: FileMetadata, state: CollectionState, current: string) => {
  const size = Number(metadata.size);
  if (!Number.isSafeInteger(size)) throw new Error(`Upload source is too large: ${current}`);
  if (state.files >= MAX_UPLOAD_SESSIONS_PER_OWNER) throw new Error(`Upload source exceeds the ${MAX_UPLOAD_SESSIONS_PER_OWNER}-file relay limit.`);
  if (state.bytes + size > MAX_STAGED_UPLOAD_BYTES_PER_OWNER) throw new Error(`Upload source exceeds the ${MAX_STAGED_UPLOAD_BYTES_PER_OWNER}-byte relay limit.`);
  state.files += 1;
  state.bytes += size;
  return size;
};
const walk = async (root: string, current: string, directorySource: boolean, output: UploadSource[], state: CollectionState, signal?: AbortSignal, directoryGroupId?: string) => {
  signal?.throwIfAborted();
  const metadata = await lstat(current, { bigint: true });
  if (metadata.isSymbolicLink()) throw new Error(`Symbolic upload sources are unsupported: ${current}`);
  if (metadata.isFile()) {
    const size = addFile(metadata, state, current);
    const relativePath = (relative(root, current) || basename(current)).split(sep).join("/");
    const signature = `${metadata.dev}:${metadata.ino}:${metadata.size}:${metadata.mtimeNs}:${metadata.ctimeNs}`;
    output.push({ path: current, relativePath, size, signature, directorySource, directoryGroupId });
    return;
  }
  if (!metadata.isDirectory()) throw new Error(`Unsupported upload source: ${current}`);
  const entries = await readdir(current, { withFileTypes: true });
  for (const entry of entries) await walk(root, join(current, entry.name), directorySource, output, state, signal, directoryGroupId);
};

export const collectUploadFiles = async (paths: string[], signal?: AbortSignal) => {
  const output: UploadSource[] = [];
  const state: CollectionState = { bytes: 0, files: 0 };
  for (const path of paths) {
    signal?.throwIfAborted();
    const metadata = await lstat(path);
    const directorySource = metadata.isDirectory();
    await walk(dirname(path), path, directorySource, output, state, signal, directorySource ? randomUUID() : undefined);
  }
  if (!output.length) throw new Error("Upload sources contain no files.");
  const standaloneGroupId = randomUUID();
  let standaloneIndex = 0;
  for (const source of output) if (!source.directorySource) {
    source.directoryGroupId = standaloneGroupId;
    source.relativePath = `${standaloneGroupId}/${standaloneIndex}/${basename(source.path)}`;
    standaloneIndex += 1;
  }
  return output;
};
