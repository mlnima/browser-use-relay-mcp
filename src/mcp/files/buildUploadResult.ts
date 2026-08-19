import { MAX_UPLOAD_TOOL_RESULT_BYTES, MAX_UPLOAD_TOOL_RESULT_ENVELOPE_BYTES } from "../../protocol/limits.js";
import type { ActionResult } from "../../types/action.js";
import type { JsonValue } from "../../types/json.js";
import type { UploadSource } from "./collectUploadFiles.js";

type Completion = { transferId: string; path: string };
type FileMetadata = { transferIndex: number; source: string; remotePath: string; bytes: number };

export const buildUploadResult = (
  sources: UploadSource[],
  completions: Completion[],
  directoryRoots: string[],
  action: ActionResult,
): JsonValue => {
  const files: FileMetadata[] = [];
  const roots: string[] = [];
  const pathMetadata = {
    files,
    directoryRoots: roots,
    totalFiles: sources.length,
    returnedFiles: 0,
    omittedFiles: sources.length,
    totalDirectoryRoots: directoryRoots.length,
    returnedDirectoryRoots: 0,
    omittedDirectoryRoots: directoryRoots.length,
    truncated: false,
    reason: null as string | null,
    byteLimit: MAX_UPLOAD_TOOL_RESULT_BYTES,
    encodedBytes: 0,
  };
  const output = {
    transferIds: completions.map(({ transferId }) => transferId),
    pathMetadata,
    action: {
      id: action.id, success: action.success, engine: action.engine,
      data: action.data ?? null, revision: action.revision ?? null, durationMs: action.durationMs,
    },
  };
  const mandatoryBytes = Buffer.byteLength(JSON.stringify(output));
  const entryBudget = MAX_UPLOAD_TOOL_RESULT_BYTES - mandatoryBytes - MAX_UPLOAD_TOOL_RESULT_ENVELOPE_BYTES;
  if (entryBudget < 0) throw new Error("Mandatory upload result metadata exceeds the MCP result byte limit.");
  let entryBytes = 0;
  const add = <Value>(target: Value[], value: Value) => {
    const bytes = Buffer.byteLength(JSON.stringify(value)) + Number(target.length > 0);
    if (entryBytes + bytes > entryBudget) return false;
    target.push(value);
    entryBytes += bytes;
    return true;
  };
  for (const root of directoryRoots) add(roots, root);
  for (const [index, source] of sources.entries()) add(files, {
    transferIndex: index, source: source.path, remotePath: completions[index]!.path, bytes: source.size,
  });
  pathMetadata.returnedFiles = files.length;
  pathMetadata.omittedFiles = sources.length - files.length;
  pathMetadata.returnedDirectoryRoots = roots.length;
  pathMetadata.omittedDirectoryRoots = directoryRoots.length - roots.length;
  pathMetadata.truncated = pathMetadata.omittedFiles > 0 || pathMetadata.omittedDirectoryRoots > 0;
  pathMetadata.reason = pathMetadata.truncated ? "PATH_METADATA_BYTE_BUDGET_EXCEEDED" : null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const encodedBytes = Buffer.byteLength(JSON.stringify(output));
    if (pathMetadata.encodedBytes === encodedBytes) break;
    pathMetadata.encodedBytes = encodedBytes;
  }
  const finalBytes = Buffer.byteLength(JSON.stringify(output));
  if (finalBytes > MAX_UPLOAD_TOOL_RESULT_BYTES || finalBytes !== pathMetadata.encodedBytes)
    throw new Error("Upload result metadata could not satisfy its encoded byte budget.");
  return output as unknown as JsonValue;
};
