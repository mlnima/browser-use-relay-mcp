import type { Hash } from "node:crypto";

export type UploadState = {
  path: string;
  fileName: string;
  declaredName: string;
  declaredRelativePath?: string;
  directoryGroupId?: string;
  nextChunk: number;
  totalChunks?: number;
  totalBytes?: number;
  mimeType?: string;
  relativePath?: string;
  directoryRoot?: string;
  directoryReady?: boolean;
  bytes: number;
  hashes: string[];
  hash: Hash;
  digest?: string;
  retentionDeadline?: number;
  owner: object;
  complete: boolean;
  retiring?: boolean;
  lease?: NodeJS.Timeout;
};
