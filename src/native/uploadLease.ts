import { UPLOAD_LEASE_TIMEOUT_MS } from "./constants.js";
import type { UploadState } from "./uploadState.js";

export const clearUploadLease = (state: UploadState) => {
  if (state.lease) clearTimeout(state.lease);
  state.lease = undefined;
};

export const refreshUploadLease = (state: UploadState, expire: () => void, durationMs = UPLOAD_LEASE_TIMEOUT_MS) => {
  clearUploadLease(state);
  const lease = setTimeout(() => {
    if (state.lease !== lease) return;
    state.lease = undefined;
    expire();
  }, durationMs);
  lease.unref();
  state.lease = lease;
};
