import { MAX_UPLOAD_GROUP_FINALIZE_PARAMETERS_BYTES, MAX_UPLOAD_SESSIONS_PER_OWNER } from "../protocol/limits.js";
import type { ActionRequest } from "../types/action.js";
import { createNativeError } from "./nativeError.js";

export type FinalizeUploadGroupInput = { directoryGroupId: string; expectedFiles: number };
const groupKeys = new Set(["directoryGroupId", "expectedFiles"]);
const parameterKeys = new Set(["operation", "groups"]);

export const readFinalizeUploadGroups = (request: ActionRequest) => {
  const params = request.params;
  const values = params?.groups;
  if (!params || Object.keys(params).some((key) => !parameterKeys.has(key)) ||
    !Array.isArray(values) || !values.length || values.length > MAX_UPLOAD_SESSIONS_PER_OWNER)
    throw createNativeError("INVALID_NATIVE_PARAMETERS", "Bulk group finalization requires a bounded groups array.");
  if (Buffer.byteLength(JSON.stringify(params)) > MAX_UPLOAD_GROUP_FINALIZE_PARAMETERS_BYTES)
    throw createNativeError("NATIVE_MESSAGE_TOO_LARGE", "Bulk group finalization parameters exceed the native message budget.");
  const seen = new Set<string>();
  let totalFiles = 0;
  const groups = values.map((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).some((key) => !groupKeys.has(key)))
      throw createNativeError("INVALID_NATIVE_PARAMETERS", "Each finalization group requires only an id and expected file count.");
    const item = value as Record<string, unknown>;
    const directoryGroupId = item.directoryGroupId;
    const expectedFiles = item.expectedFiles;
    if (typeof directoryGroupId !== "string" || !directoryGroupId || directoryGroupId.length > 256 ||
      typeof expectedFiles !== "number" || !Number.isSafeInteger(expectedFiles) || expectedFiles < 1)
      throw createNativeError("INVALID_NATIVE_PARAMETERS", "Finalization group ids and expected file counts are invalid.");
    if (seen.has(directoryGroupId))
      throw createNativeError("INVALID_NATIVE_PARAMETERS", "Bulk finalization group ids must be unique.");
    seen.add(directoryGroupId);
    totalFiles += expectedFiles;
    if (totalFiles > MAX_UPLOAD_SESSIONS_PER_OWNER)
      throw createNativeError("INVALID_NATIVE_PARAMETERS", "Bulk finalization exceeds the staged-file limit.");
    return { directoryGroupId, expectedFiles };
  });
  return groups;
};
