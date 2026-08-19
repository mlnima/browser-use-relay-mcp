import { createHash } from "node:crypto";

export const DOWNLOAD_CHUNK_BYTES = 384 * 1024;
const maxBase64Characters = Math.ceil(DOWNLOAD_CHUNK_BYTES / 3) * 4;
type Chunk = { buffer: Buffer; totalBytes: number; complete: boolean };

export const readDownloadChunk = (
  data: Record<string, unknown>,
  transferId: string,
  chunkIndex: number,
  offset: number,
  previousTotal?: number,
): Chunk => {
  if (data.transferId !== transferId || data.chunkIndex !== chunkIndex || data.offset !== offset)
    throw new Error(`Downloaded chunk ${chunkIndex} has inconsistent transfer metadata.`);
  const totalBytes = data.totalBytes;
  const bytesRead = data.bytesRead;
  if (typeof totalBytes !== "number" || !Number.isSafeInteger(totalBytes) || totalBytes < 0 ||
    typeof bytesRead !== "number" || !Number.isSafeInteger(bytesRead) || bytesRead < 0 ||
    typeof data.complete !== "boolean" || typeof data.chunkBase64 !== "string" ||
    typeof data.chunkSha256 !== "string" || !/^[a-f\d]{64}$/i.test(data.chunkSha256))
    throw new Error(`Downloaded chunk ${chunkIndex} has invalid result fields.`);
  if (previousTotal !== undefined && previousTotal !== totalBytes)
    throw new Error("The remote file size changed during transfer.");
  if (offset > totalBytes) throw new Error(`Downloaded chunk ${chunkIndex} starts beyond the declared file size.`);
  const expectedBytes = Math.min(DOWNLOAD_CHUNK_BYTES, totalBytes - offset);
  const expectedComplete = expectedBytes === totalBytes - offset;
  const expectedBase64Characters = Math.ceil(expectedBytes / 3) * 4;
  if (bytesRead !== expectedBytes || data.complete !== expectedComplete ||
    data.chunkBase64.length !== expectedBase64Characters || data.chunkBase64.length > maxBase64Characters)
    throw new Error(`Downloaded chunk ${chunkIndex} has an invalid byte count.`);
  const buffer = Buffer.from(data.chunkBase64, "base64");
  if (buffer.length !== bytesRead || buffer.toString("base64") !== data.chunkBase64)
    throw new Error(`Downloaded chunk ${chunkIndex} has invalid base64 data.`);
  const digest = createHash("sha256").update(buffer).digest("hex");
  if (digest !== data.chunkSha256.toLowerCase())
    throw new Error(`Downloaded chunk ${chunkIndex} failed integrity verification.`);
  return { buffer, totalBytes, complete: data.complete };
};
