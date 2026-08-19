export const MAX_SCREENSHOT_DIMENSION = 32_767;
export const MAX_SCREENSHOT_PIXELS = 64_000_000;
export const MAX_SCREENSHOT_BLOB_BYTES = 40 * 1024 * 1024;
export const MAX_SCREENSHOT_BASE64_CHARACTERS = Math.ceil(MAX_SCREENSHOT_BLOB_BYTES / 3) * 4;

export const validateScreenshotDimensions = (width: number, height: number, label: string) => {
  const dimensions = { width: Math.ceil(width), height: Math.ceil(height) };
  if (![dimensions.width, dimensions.height].every(Number.isFinite) || dimensions.width < 1 || dimensions.height < 1) {
    throw new Error(`${label} has no capturable area.`);
  }
  if (dimensions.width > MAX_SCREENSHOT_DIMENSION || dimensions.height > MAX_SCREENSHOT_DIMENSION) {
    throw new Error(`${label} dimensions ${dimensions.width}x${dimensions.height} exceed the ${MAX_SCREENSHOT_DIMENSION}-pixel canvas limit.`);
  }
  if (dimensions.width * dimensions.height > MAX_SCREENSHOT_PIXELS) {
    throw new Error(`${label} area ${dimensions.width * dimensions.height} exceeds the ${MAX_SCREENSHOT_PIXELS}-pixel resource limit.`);
  }
  return dimensions;
};

const decodedByteLength = (data: string) => Math.floor(data.length * 3 / 4) - (data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0);

export const validateScreenshotBase64 = (data: string) => {
  if (data.length > MAX_SCREENSHOT_BASE64_CHARACTERS) throw new Error("The screenshot base64 payload exceeds the native relay transport limit.");
  const byteLength = decodedByteLength(data);
  if (byteLength < 0 || byteLength > MAX_SCREENSHOT_BLOB_BYTES) throw new Error("The screenshot image exceeds the native relay transport limit.");
  return byteLength;
};

export const parseScreenshotDataUrl = (dataUrl: string) => {
  const format = dataUrl.startsWith("data:image/png;base64,") ? "png"
    : dataUrl.startsWith("data:image/jpeg;base64,") ? "jpeg" : undefined;
  if (!format) throw new Error("The screenshot data URL is invalid.");
  const data = dataUrl.slice(`data:image/${format};base64,`.length);
  validateScreenshotBase64(data);
  return { data, format } as const;
};

const decodeScreenshot = (data: string) => {
  const bytes = new Uint8Array(validateScreenshotBase64(data));
  let written = 0;
  for (let offset = 0; offset < data.length; offset += 0x8000) {
    const binary = atob(data.slice(offset, offset + 0x8000));
    if (written + binary.length > bytes.length) throw new Error("The screenshot base64 payload is invalid.");
    for (let index = 0; index < binary.length; index += 1) bytes[written + index] = binary.charCodeAt(index);
    written += binary.length;
  }
  if (written !== bytes.length) throw new Error("The screenshot base64 payload is invalid.");
  return bytes;
};

export const screenshotDataUrl = (data: string, format: "jpeg" | "png") =>
  (validateScreenshotBase64(data), `data:image/${format};base64,${data}`);

export const blobDataUrl = async (blob: Blob) => {
  if (blob.size > MAX_SCREENSHOT_BLOB_BYTES) throw new Error("The screenshot image exceeds the native relay transport limit.");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return `data:${blob.type};base64,${btoa(binary)}`;
};

export const screenshotBitmap = async (data: string, format: "jpeg" | "png") => {
  const blob = new Blob([decodeScreenshot(data)], { type: `image/${format}` });
  if (blob.size > MAX_SCREENSHOT_BLOB_BYTES) throw new Error("The screenshot image exceeds the native relay transport limit.");
  const bitmap = await createImageBitmap(blob);
  try {
    validateScreenshotDimensions(bitmap.width, bitmap.height, "Decoded screenshot");
    return bitmap;
  } catch (error) {
    bitmap.close();
    throw error;
  }
};
