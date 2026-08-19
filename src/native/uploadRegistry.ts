import { createStagingRoot } from "./stagingRoots.js";
import type { UploadState } from "./uploadState.js";

export const uploads = new Map<string, UploadState>();
let stagingRoot: string | undefined;
let stagingCreation: Promise<string> | undefined;

export const getUploadRoot = async () => {
  if (stagingRoot) return stagingRoot;
  stagingCreation ||= createStagingRoot().then((root) => stagingRoot = root);
  try {
    return await stagingCreation;
  } finally {
    stagingCreation = undefined;
  }
};
export const currentUploadRoot = () => stagingRoot;

export const resetUploadRegistry = () => {
  const path = stagingRoot;
  stagingRoot = undefined;
  uploads.clear();
  return path;
};
