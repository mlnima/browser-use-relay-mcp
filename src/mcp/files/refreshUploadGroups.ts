import { basename } from "node:path";
import { MAX_UPLOAD_GROUP_OPERATION_CONCURRENCY, UPLOAD_GROUP_REFRESH_INTERVAL_MS } from "../../protocol/limits.js";
import type { RelayClient } from "../../types/mcp.js";
import { createActionRequest } from "../createActionRequest.js";
import type { UploadSource } from "./collectUploadFiles.js";
import { UPLOAD_CHUNK_BYTES } from "./uploadSource.js";

type Completion = { transferId: string; path: string; sha256: string };
type Representative = { source: UploadSource; completion: Completion; groupId: string; refreshedAt: number };

const refreshGroup = async (client: RelayClient, entry: Representative, signal: AbortSignal) => {
  const { source, completion } = entry;
  const totalChunks = Math.ceil(source.size / UPLOAD_CHUNK_BYTES);
  const result = await client.execute(createActionRequest({
    action: "uploadFile",
    engine: "native",
    params: {
      operation: "begin", transferId: completion.transferId, fileName: basename(source.path),
      relativePath: source.relativePath, directoryGroupId: entry.groupId,
      totalChunks, totalBytes: source.size,
    },
  }), signal);
  if (!result.success) throw new Error(result.error?.message || "Upload group refresh failed.");
  if (!result.data || typeof result.data !== "object" || Array.isArray(result.data))
    throw new Error("Upload group refresh returned invalid result data.");
  const data = result.data as Record<string, unknown>;
  if (data.transferId !== completion.transferId || data.path !== completion.path ||
    data.fileName !== basename(source.path) || data.relativePath !== source.relativePath ||
    data.nextChunk !== totalChunks || data.bytes !== source.size || data.complete !== true ||
    data.sha256 !== completion.sha256)
    throw new Error("Upload group refresh returned inconsistent completion metadata.");
};

export const createUploadGroupRefresher = (client: RelayClient, signal: AbortSignal) => {
  const representatives = new Map<string, Representative>();
  const add = (source: UploadSource, completion: Completion) => {
    if (source.directoryGroupId && !representatives.has(source.directoryGroupId))
      representatives.set(source.directoryGroupId, { source, completion, groupId: source.directoryGroupId, refreshedAt: performance.now() });
  };
  const refreshDue = async (activeGroupId?: string) => {
    const now = performance.now();
    const due = [...representatives].filter(([id, entry]) => id !== activeGroupId &&
      now - entry.refreshedAt >= UPLOAD_GROUP_REFRESH_INTERVAL_MS);
    for (let offset = 0; offset < due.length; offset += MAX_UPLOAD_GROUP_OPERATION_CONCURRENCY) {
      const batch = due.slice(offset, offset + MAX_UPLOAD_GROUP_OPERATION_CONCURRENCY);
      const settled = await Promise.allSettled(batch.map(([, entry]) => refreshGroup(client, entry, signal)));
      const failure = settled.find((result) => result.status === "rejected");
      if (failure?.status === "rejected") throw failure.reason;
      const refreshedAt = performance.now();
      for (const [id] of batch) representatives.get(id)!.refreshedAt = refreshedAt;
    }
  };
  return { add, refreshDue };
};
