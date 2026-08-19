import {
  CAPTURE_FAILURE_LEASE_MS, CAPTURE_RESOURCE_LEASE_MS, MAX_CAPTURE_AGGREGATE_BYTES,
  MAX_CAPTURE_ERROR_LENGTH, MAX_CAPTURE_FAILURES, MAX_CAPTURE_RESOURCES,
} from "./limits.js";
import { captureFailures, captureResources, captureSessions } from "./state.js";

const firstKey = <T>(values: Map<string, T>) => values.keys().next().value as string | undefined;
export const releaseCaptureResource = (resourceId: string) => {
  const resource = captureResources.get(resourceId);
  if (!resource) return false;
  clearTimeout(resource.lease);
  URL.revokeObjectURL(resource.blobUrl);
  captureResources.delete(resourceId);
  return true;
};
const activeBytes = () => {
  let bytes = 0;
  for (const session of captureSessions.values()) bytes += session.bytes;
  return bytes;
};
const retainedBytes = () => {
  let bytes = 0;
  for (const resource of captureResources.values()) bytes += resource.size;
  return bytes;
};
export const totalCaptureBytes = () => activeBytes() + retainedBytes();
export const retainCaptureResource = (recording: Blob) => {
  while (captureResources.size && (captureResources.size >= MAX_CAPTURE_RESOURCES ||
    totalCaptureBytes() + recording.size > MAX_CAPTURE_AGGREGATE_BYTES)) {
    const oldest = firstKey(captureResources);
    if (!oldest) break;
    releaseCaptureResource(oldest);
  }
  if (totalCaptureBytes() + recording.size > MAX_CAPTURE_AGGREGATE_BYTES)
    throw new Error("CAPTURE_AGGREGATE_BYTE_LIMIT: The retained recording exceeds the capture byte limit.");
  const resourceId = crypto.randomUUID();
  const blobUrl = URL.createObjectURL(recording);
  const lease = setTimeout(() => releaseCaptureResource(resourceId), CAPTURE_RESOURCE_LEASE_MS);
  captureResources.set(resourceId, { blobUrl, size: recording.size, createdAt: Date.now(), lease });
  return { resourceId, blobUrl };
};
const deleteFailure = (captureId: string) => {
  const failure = captureFailures.get(captureId);
  if (!failure) return;
  clearTimeout(failure.lease);
  captureFailures.delete(captureId);
};
export const clearCaptureFailure = (captureId: string) => deleteFailure(captureId);
export const rememberCaptureFailure = (captureId: string, value: unknown) => {
  const source = value instanceof Error ? value.message : String(value);
  const message = source.slice(0, MAX_CAPTURE_ERROR_LENGTH) || "Tab capture failed.";
  deleteFailure(captureId);
  while (captureFailures.size >= MAX_CAPTURE_FAILURES) {
    const oldest = firstKey(captureFailures);
    if (!oldest) break;
    deleteFailure(oldest);
  }
  const lease = setTimeout(() => deleteFailure(captureId), CAPTURE_FAILURE_LEASE_MS);
  captureFailures.set(captureId, { message, createdAt: Date.now(), lease });
  return new Error(message);
};
export const captureFailureMessage = (captureId: string) => captureFailures.get(captureId)?.message;
