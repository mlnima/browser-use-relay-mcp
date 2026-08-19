import {
  MAX_SNAPSHOT_CATALOG_BYTES, MAX_SNAPSHOT_STRING_CHARACTERS,
} from "../../../src/protocol/limits.js";

const encoder = new TextEncoder();
export type SnapshotStringStats = { truncatedStrings: number };

export const createSnapshotStringLimiter = () => {
  const stats: SnapshotStringStats = { truncatedStrings: 0 };
  const limit = (value: string | undefined): string | undefined => {
    if (value === undefined || value.length <= MAX_SNAPSHOT_STRING_CHARACTERS) return value;
    stats.truncatedStrings += 1;
    const sliced = value.slice(0, MAX_SNAPSHOT_STRING_CHARACTERS);
    return /[\uD800-\uDBFF]$/.test(sliced) ? sliced.slice(0, -1) : sliced;
  };
  return { limit, stats };
};

export const snapshotEncodedBytes = (value: unknown) => encoder.encode(JSON.stringify(value)).byteLength;

export const snapshotCatalogByteLimit = (value: unknown) => typeof value === "number" && Number.isFinite(value)
  ? Math.max(0, Math.min(MAX_SNAPSHOT_CATALOG_BYTES, Math.floor(value)))
  : MAX_SNAPSHOT_CATALOG_BYTES;
