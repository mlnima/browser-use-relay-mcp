import type { ClipboardRequest, ClipboardValue } from "./types.js";
import { MAX_CLIPBOARD_TOTAL_BYTES, MAX_CLIPBOARD_TYPES, MAX_CLIPBOARD_WRITE_BYTES } from "../../../../src/protocol/limits.js";
import { clipboardBlob, clipboardItems, clipboardText, clipboardTypes, encodeClipboardBlob } from "./clipboard-values.js";

const readClipboard = async (formats?: string[]) => {
  const requested = formats?.length ? clipboardTypes(formats) : undefined;
  const output = [];
  let totalBytes = 0;
  let totalTypes = 0;
  for (const item of clipboardItems(await navigator.clipboard.read())) {
    const types = clipboardTypes(requested ? item.types.filter((type) => requested.includes(type)) : item.types);
    totalTypes += types.length;
    if (totalTypes > MAX_CLIPBOARD_TYPES) throw new Error(`Clipboard data exceeds the ${MAX_CLIPBOARD_TYPES}-type aggregate limit.`);
    const data: Record<string, { base64: string; size: number }> = {};
    for (const type of types) {
      const encoded = await encodeClipboardBlob(await item.getType(type), MAX_CLIPBOARD_TOTAL_BYTES - totalBytes);
      data[type] = encoded;
      totalBytes += encoded.size;
    }
    output.push({ types, data });
  }
  return { items: output, totalBytes, totalByteLimit: MAX_CLIPBOARD_TOTAL_BYTES };
};

const writeClipboard = async (request: ClipboardRequest) => {
  if (!request.items?.length && request.html === undefined) {
    const bytes = clipboardText(request.text || "");
    if (bytes.byteLength > MAX_CLIPBOARD_WRITE_BYTES) throw new Error(`Clipboard write data exceeds ${MAX_CLIPBOARD_WRITE_BYTES} bytes.`);
    await navigator.clipboard.writeText(request.text || "");
    return { items: 1, types: ["text/plain"], totalBytes: bytes.byteLength };
  }
  const inputs = request.items?.length ? request.items : [{ data: {
    ...(request.text !== undefined && { "text/plain": { text: request.text } }),
    ...(request.html !== undefined && { "text/html": { text: request.html } }),
  } }];
  clipboardItems(inputs);
  let totalBytes = 0;
  let totalTypes = 0;
  const items = inputs.map((item) => new ClipboardItem(Object.fromEntries(clipboardTypes(Object.keys(item.data)).map((type) => {
    totalTypes += 1;
    if (totalTypes > MAX_CLIPBOARD_TYPES) throw new Error(`Clipboard data exceeds the ${MAX_CLIPBOARD_TYPES}-type aggregate limit.`);
    const output = clipboardBlob(type, item.data[type] as ClipboardValue, MAX_CLIPBOARD_WRITE_BYTES - totalBytes);
    totalBytes += output.bytes;
    return [type, output.blob];
  }))));
  await navigator.clipboard.write(items);
  return { items: items.length, types: [...new Set(inputs.flatMap((item) => Object.keys(item.data)))], totalBytes };
};

export const handleClipboardMessage = async (request: ClipboardRequest) => request.operation === "read"
  ? readClipboard(request.formats)
  : writeClipboard(request);
