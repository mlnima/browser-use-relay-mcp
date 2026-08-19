import { MAX_UPLOAD_GROUP_FINALIZE_PARAMETERS_BYTES } from "../../protocol/limits.js";
import type { RelayClient } from "../../types/mcp.js";
import { createActionRequest } from "../createActionRequest.js";

export const finalizeUploadGroups = async (client: RelayClient, groupIds: string[], signal: AbortSignal) => {
  const counts = new Map<string, number>();
  for (const id of groupIds) counts.set(id, (counts.get(id) || 0) + 1);
  const groups = [...counts].map(([id, expectedFiles]) => ({ id, expectedFiles }));
  if (!groups.length) return [];
  const params = {
    operation: "finalizeGroups",
    groups: groups.map(({ id, expectedFiles }) => ({ directoryGroupId: id, expectedFiles })),
  };
  if (Buffer.byteLength(JSON.stringify(params)) > MAX_UPLOAD_GROUP_FINALIZE_PARAMETERS_BYTES)
    throw new Error("Upload groups exceed the atomic native finalization message budget.");
  const result = await client.execute(createActionRequest({ action: "uploadFile", engine: "native", params }), signal);
  if (!result.success) throw new Error(result.error?.message || "Upload groups could not be finalized atomically.");
  if (!result.data || typeof result.data !== "object" || Array.isArray(result.data))
    throw new Error("Atomic upload group finalization returned invalid result data.");
  const data = result.data as Record<string, unknown>;
  if (Object.keys(data).length !== 3 || data.complete !== true || typeof data.retentionDeadline !== "number" ||
    !Number.isSafeInteger(data.retentionDeadline) || !Array.isArray(data.groups) || data.groups.length !== groups.length)
    throw new Error("Atomic upload group finalization returned inconsistent summary data.");
  const roots: string[] = [];
  for (const [index, value] of data.groups.entries()) {
    const expected = groups[index]!;
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("Atomic upload group finalization returned an invalid group entry.");
    const entry = value as Record<string, unknown>;
    if (Object.keys(entry).length !== 3 || entry.directoryGroupId !== expected.id || entry.files !== expected.expectedFiles ||
      typeof entry.directoryRoot !== "string" || !entry.directoryRoot)
      throw new Error("Atomic upload group finalization returned inconsistent group metadata.");
    roots.push(entry.directoryRoot);
  }
  if (new Set(roots).size !== roots.length)
    throw new Error("Atomic upload group finalization returned duplicate directory roots.");
  return roots;
};
