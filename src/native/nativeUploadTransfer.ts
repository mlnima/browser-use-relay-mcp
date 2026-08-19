import type { ActionRequest } from "../types/action.js";
import type { JsonValue } from "../types/json.js";
import { createNativeError, throwIfAborted, toActionError } from "./nativeError.js";
import { integerParam, requiredStringParam, stringArrayParam, stringParam } from "./nativeParams.js";
import { cancelUpload } from "./uploadCleanup.js";
import { appendUploadChunk, startUpload } from "./uploadStore.js";
import { finishUpload } from "./finishUpload.js";
import { finalizeUploadGroup } from "./finalizeUploadGroup.js";
import { finalizeUploadGroups } from "./finalizeUploadGroups.js";
import { readFinalizeUploadGroups } from "./readFinalizeUploadGroups.js";

const stateResult = (
  transferId: string,
  state: Awaited<ReturnType<typeof startUpload>>,
  complete: boolean,
): JsonValue => ({
  transferId,
  fileName: state.fileName,
  path: state.path,
  nextChunk: state.nextChunk,
  bytes: state.bytes,
  complete,
  ...(state.mimeType ? { mimeType: state.mimeType } : {}),
  ...(state.relativePath ? { relativePath: state.relativePath } : {}),
  ...(state.directoryRoot && (!state.directoryGroupId || state.directoryReady) ? { directoryRoot: state.directoryRoot } : {}),
  ...(state.digest ? { sha256: state.digest } : {}),
});

export const isUploadTransferRequest = (request: ActionRequest) => request.action === "uploadFile";

const cancelMany = async (request: ActionRequest, owner: object): Promise<JsonValue> => {
  const requested = stringArrayParam(request, "transferIds");
  if (!requested?.length || requested.some((id) => !id))
    throw createNativeError("INVALID_NATIVE_PARAMETERS", "Parameter \"transferIds\" must contain non-empty strings.");
  const transferIds = [...new Set(requested)];
  const settled = await Promise.allSettled(transferIds.map((id) => cancelUpload(id, owner)));
  const failures = settled.flatMap((result, index) => {
    if (result.status === "fulfilled") return [];
    const error = toActionError(result.reason);
    return [{ transferId: transferIds[index] || "", code: error.code, message: error.message, retryable: error.retryable }];
  });
  const cancelled = settled.filter((result) => result.status === "fulfilled" && result.value).length;
  const missing = settled.filter((result) => result.status === "fulfilled" && !result.value).length;
  return { requested: requested.length, unique: transferIds.length, cancelled, missing, failed: failures.length, failures };
};

export const executeNativeUploadTransfer = async (
  request: ActionRequest,
  signal: AbortSignal,
  owner: object,
): Promise<JsonValue | undefined> => {
  const operation = stringParam(request, "operation") || "chunk";
  if (operation === "cancelMany") return cancelMany(request, owner);
  if (operation === "finalizeGroup")
    return finalizeUploadGroup(requiredStringParam(request, "directoryGroupId"), owner);
  if (operation === "finalizeGroups") return finalizeUploadGroups(readFinalizeUploadGroups(request), owner);
  const transferId = requiredStringParam(request, "transferId");
  if (operation === "cancel") {
    await cancelUpload(transferId, owner);
    return { transferId, cancelled: true };
  }
  if (["begin", "start"].includes(operation)) {
    const totalChunks = integerParam(request, "totalChunks");
    const totalBytes = request.params?.totalBytes === undefined ? undefined : integerParam(request, "totalBytes");
    if (totalChunks < 0 || (totalBytes !== undefined && totalBytes < 0))
      throw createNativeError("INVALID_TRANSFER_SIZE", "Transfer sizes cannot be negative.");
    const state = await startUpload(
      transferId,
      requiredStringParam(request, "fileName"),
      totalChunks,
      owner,
      totalBytes,
      stringParam(request, "mimeType"),
      stringParam(request, "relativePath"),
      stringParam(request, "directoryGroupId"),
    );
    return stateResult(transferId, state, state.complete);
  }
  if (["end", "finish"].includes(operation)) return stateResult(
    transferId, finishUpload(transferId, owner, requiredStringParam(request, "expectedSha256")), true,
  );
  if (operation !== "chunk")
    throw createNativeError("INVALID_TRANSFER_OPERATION", `Unsupported upload transfer operation "${operation}".`);
  throwIfAborted(signal);
  const state = await appendUploadChunk(
    transferId,
    integerParam(request, "chunkIndex", 0),
    requiredStringParam(request, "chunkBase64"),
    owner,
  );
  throwIfAborted(signal);
  return stateResult(transferId, state, state.complete);
};
