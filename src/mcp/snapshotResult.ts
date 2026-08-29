import { MAX_SNAPSHOT_ATTRIBUTES, MAX_SNAPSHOT_FRAMES, MAX_SNAPSHOT_IMAGE_BYTES, MAX_SNAPSHOT_RESULT_BYTES, MAX_SNAPSHOT_SELECTED_VALUES, MAX_SNAPSHOT_STRING_CHARACTERS } from "../protocol/limits.js";
import type { ActionResult } from "../types/action.js";
import type { JsonValue } from "../types/json.js";

type JsonRecord = Record<string, JsonValue>;
type CompactElement = { value: JsonRecord; omittedAttributes: number };
const envelopeReserveBytes = 8 * 1024;
const prioritizedAttributeNames = [
  "aria-activedescendant", "aria-busy", "aria-checked", "aria-selected", "aria-valuenow", "aria-valuetext",
  "aria-valuemin", "aria-valuemax", "aria-expanded", "aria-pressed", "aria-current", "aria-invalid", "aria-haspopup",
  "aria-controls", "aria-describedby", "aria-required", "aria-disabled", "aria-readonly", "aria-hidden", "aria-sort",
  "aria-level", "aria-orientation", "aria-multiselectable", "aria-live", "data-testid", "data-test", "data-qa",
  "tabindex", "type", "name", "id", "title", "alt", "for", "autocomplete", "inputmode", "accept", "multiple",
  "required", "min", "max", "step", "pattern",
] as const;
const attributePriority = new Map(prioritizedAttributeNames.map((name, index) => [name, index]));

const recordValue = (value: JsonValue | undefined): JsonRecord | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : undefined;
const limitedString = (value: JsonValue | undefined) => typeof value === "string"
  ? value.slice(0, MAX_SNAPSHOT_STRING_CHARACTERS) : undefined;
const metadataString = (value: JsonValue | undefined) => limitedString(value)?.slice(0, 256);
const finiteInteger = (value: JsonValue | undefined) => typeof value === "number" && Number.isFinite(value)
  ? Math.max(0, Math.floor(value)) : null;
const byteLength = (value: unknown) => Buffer.byteLength(JSON.stringify(value), "utf8");
const definedRecord = (entries: Array<[string, JsonValue | undefined]>) => Object.fromEntries(
  entries.filter((entry): entry is [string, JsonValue] => entry[1] !== undefined),
) as JsonRecord;

const compactAttributes = (value: JsonValue | undefined) => {
  const attributes = recordValue(value);
  if (!attributes) return { value: undefined, omitted: 0 };
  const selected = Object.entries(attributes)
    .filter(([name, item]) => attributePriority.has(name.toLowerCase() as typeof prioritizedAttributeNames[number]) && typeof item === "string")
    .sort(([left], [right]) => (attributePriority.get(left.toLowerCase() as typeof prioritizedAttributeNames[number]) || 0)
      - (attributePriority.get(right.toLowerCase() as typeof prioritizedAttributeNames[number]) || 0))
    .slice(0, MAX_SNAPSHOT_ATTRIBUTES)
    .map(([name, item]) => [name, limitedString(item)] as [string, JsonValue]);
  return {
    value: selected.length ? Object.fromEntries(selected) as JsonRecord : undefined,
    omitted: Math.max(0, Object.keys(attributes).length - selected.length),
  };
};

const compactElement = (value: JsonValue): CompactElement | undefined => {
  const element = recordValue(value);
  if (!element) return undefined;
  const attributes = compactAttributes(element.attributes);
  const name = limitedString(element.name);
  const text = limitedString(element.text);
  const selectedValues = Array.isArray(element.selectedValues)
    ? element.selectedValues.slice(0, MAX_SNAPSHOT_SELECTED_VALUES).flatMap((item) => {
      const selected = limitedString(item);
      return selected === undefined ? [] : [selected];
    })
    : undefined;
  return {
    value: definedRecord([
      ["id", limitedString(element.id)], ["tag", limitedString(element.tag)], ["role", limitedString(element.role)],
      ["name", name], ["text", text === name ? undefined : text], ["value", limitedString(element.value)],
      ["href", limitedString(element.href)], ["placeholder", limitedString(element.placeholder)],
      ["visible", element.visible === false ? false : undefined], ["enabled", element.enabled === false ? false : undefined],
      ["editable", element.editable === true ? true : undefined], ["readonly", element.readonly === true ? true : undefined],
      ["checked", typeof element.checked === "boolean" ? element.checked : undefined],
      ["selected", typeof element.selected === "boolean" ? element.selected : undefined],
      ["selectedValues", selectedValues?.length ? selectedValues : undefined], ["attributes", attributes.value],
    ]),
    omittedAttributes: attributes.omitted,
  };
};

const compactStrings = (value: JsonValue): JsonValue => {
  if (typeof value === "string") return value.slice(0, MAX_SNAPSHOT_STRING_CHARACTERS);
  if (Array.isArray(value)) return value.map(compactStrings);
  const record = recordValue(value);
  return record ? Object.fromEntries(Object.entries(record).map(([key, item]) => [key, compactStrings(item)])) : value;
};

const compactCatalogMetadata = (value: JsonValue | undefined) => {
  const catalog = recordValue(value) || {};
  return definedRecord([
    ["byteLimit", finiteInteger(catalog.byteLimit) ?? undefined], ["encodedBytes", finiteInteger(catalog.encodedBytes) ?? undefined],
    ["requestedElementLimit", finiteInteger(catalog.requestedElementLimit) ?? undefined],
    ["returnedFrameCount", finiteInteger(catalog.returnedFrameCount) ?? undefined],
    ["totalFrameCount", finiteInteger(catalog.totalFrameCount) ?? undefined],
    ["omittedFrameCount", finiteInteger(catalog.omittedFrameCount) ?? undefined],
    ["returnedElementCount", finiteInteger(catalog.returnedElementCount) ?? undefined],
    ["scannedElementCount", finiteInteger(catalog.scannedElementCount) ?? undefined],
    ["scannedElementLimit", finiteInteger(catalog.scannedElementLimit) ?? undefined],
    ["stringTruncationCount", finiteInteger(catalog.stringTruncationCount) ?? undefined],
    ["omittedAttributeCount", finiteInteger(catalog.omittedAttributeCount) ?? undefined],
    ["omittedSelectedValueCount", finiteInteger(catalog.omittedSelectedValueCount) ?? undefined],
    ["omittedElementCount", finiteInteger(catalog.omittedElementCount) ?? undefined],
    ["unstable", typeof catalog.unstable === "boolean" ? catalog.unstable : undefined],
    ["truncated", typeof catalog.truncated === "boolean" ? catalog.truncated : undefined],
    ["truncationReason", metadataString(catalog.truncationReason)],
  ]);
};

const countElements = (frames: readonly JsonValue[]): number => frames.reduce<number>((total, value) => {
  const frame = recordValue(value);
  return total + (Array.isArray(frame?.elements) ? frame.elements.length : 0);
}, 0);

const screenshotContent = (value: JsonValue | undefined) => {
  if (typeof value !== "string") return undefined;
  const match = value.match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z\d+/=\s]+)$/i);
  if (!match) return undefined;
  const data = match[2].replace(/\s/g, "");
  const decodedBytes = Math.max(0, Math.floor(data.length * 3 / 4) - (data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0));
  return {
    image: decodedBytes <= MAX_SNAPSHOT_IMAGE_BYTES
      ? { type: "image" as const, mimeType: match[1].toLowerCase(), data }
      : undefined,
    encodedCharacters: data.length,
    decodedBytes,
  };
};

const imageMetadata = (screenshot: NonNullable<ReturnType<typeof screenshotContent>>): JsonRecord => screenshot.image
  ? { mimeType: screenshot.image.mimeType, contentBlock: true, encodedCharacters: screenshot.encodedCharacters, decodedBytes: screenshot.decodedBytes }
  : { omitted: true, reason: "maxMcpImageBytes", byteLimit: MAX_SNAPSHOT_IMAGE_BYTES, decodedBytes: screenshot.decodedBytes };

export const compactImageActionResult = (result: ActionResult) => {
  const data = recordValue(result.data);
  const screenshot = screenshotContent(data?.dataUrl);
  if (!data || typeof data.dataUrl !== "string") return { result, image: undefined };
  const { dataUrl: _dataUrl, ...metadata } = data;
  const compacted = {
    ...result,
    data: {
      ...compactStrings(metadata as JsonValue) as JsonRecord,
      image: screenshot ? imageMetadata(screenshot) : { omitted: true, reason: "invalidImageData" },
    },
  } as ActionResult;
  if (byteLength(compacted) <= MAX_SNAPSHOT_RESULT_BYTES) return { result: compacted, image: screenshot?.image };
  return {
    result: {
      id: result.id.slice(0, 256), success: result.success, engine: result.engine, durationMs: result.durationMs,
      ...(result.revision !== undefined && { revision: result.revision }),
      data: { image: screenshot ? imageMetadata(screenshot) : { omitted: true, reason: "invalidImageData" } },
    } as ActionResult,
    image: screenshot?.image,
  };
};

export const imageActionResultContent = (result: ActionResult) => {
  const output = compactImageActionResult(result);
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(output.result) },
      ...(output.image ? [output.image] : []),
    ],
    isError: !result.success,
  };
};

const fallbackSnapshotResult = (result: ActionResult, data: JsonRecord, screenshot: ReturnType<typeof screenshotContent>, omittedElementCount: number) => {
  const sourceCatalog = recordValue(data.catalog);
  const totalOmittedElementCount = (finiteInteger(sourceCatalog?.omittedElementCount) || 0) + omittedElementCount;
  const frames = (Array.isArray(data.frames) ? data.frames : []).slice(0, MAX_SNAPSHOT_FRAMES).flatMap((value) => {
    const frame = recordValue(value);
    return frame ? [definedRecord([
      ["frameId", finiteInteger(frame.frameId) ?? undefined], ["documentId", metadataString(frame.documentId)],
      ["url", metadataString(frame.url)], ["title", metadataString(frame.title)],
      ["revision", finiteInteger(frame.revision) ?? undefined], ["elements", []],
      ["catalog", { ...compactCatalogMetadata(frame.catalog), returnedElementCount: 0, encodedBytes: 0, truncated: true, truncationReason: "maxMcpResultBytes" }],
    ])] : [];
  });
  const output = {
    id: result.id.slice(0, 256), success: result.success, engine: result.engine,
    ...(result.error && { error: {
      code: result.error.code.slice(0, 256), message: result.error.message.slice(0, MAX_SNAPSHOT_STRING_CHARACTERS), retryable: result.error.retryable,
    } }),
    ...(result.revision !== undefined && { revision: result.revision }), durationMs: result.durationMs,
    data: {
      capturedAt: metadataString(data.capturedAt) || "", tabId: finiteInteger(data.tabId),
      url: metadataString(data.url) || "", title: metadataString(data.title) || "", frames,
      page: { truncated: true },
      catalog: {
        requestedElementLimit: finiteInteger(sourceCatalog?.requestedElementLimit),
        encodedBytes: 0, returnedElementCount: 0,
        returnedFrameCount: frames.length, omittedFrameCount: Math.max(0, (Array.isArray(data.frames) ? data.frames.length : 0) - frames.length),
        truncated: true, truncationReason: "maxMcpResultBytes", omittedElementCount: totalOmittedElementCount,
      },
      outputLimits: { mcpResultByteLimit: MAX_SNAPSHOT_RESULT_BYTES },
      ...(screenshot && { screenshot: imageMetadata(screenshot) }),
    },
  } as ActionResult;
  return { result: output, image: screenshot?.image };
};

export const compactSnapshotActionResult = (result: ActionResult) => {
  const data = recordValue(result.data);
  const sourceFrames = Array.isArray(data?.frames) ? data.frames : [];
  const selectedFrames = sourceFrames.slice(0, MAX_SNAPSHOT_FRAMES);
  const screenshot = screenshotContent(data?.screenshot);
  const image = screenshot?.image;
  const frameOutputs = selectedFrames.map((value) => {
    const frame = recordValue(value) || {};
    const compacted = (Array.isArray(frame.elements) ? frame.elements : []).flatMap((element) => {
      const output = compactElement(element);
      return output ? [output] : [];
    });
    return {
      record: definedRecord([
        ["frameId", finiteInteger(frame.frameId) ?? undefined], ["documentId", metadataString(frame.documentId)],
        ["url", metadataString(frame.url) || ""], ["title", metadataString(frame.title) || ""],
        ["revision", finiteInteger(frame.revision) ?? undefined],
        ["error", frame.error === undefined ? undefined : compactStrings(frame.error)],
        ["catalog", compactCatalogMetadata(frame.catalog)], ["elements", []],
      ]),
      elements: compacted,
      retained: [] as JsonRecord[],
    };
  });
  const compactedData = data ? {
    capturedAt: metadataString(data.capturedAt) || "",
    tabId: finiteInteger(data.tabId),
    url: limitedString(data.url) || "",
    title: limitedString(data.title) || "",
    frames: frameOutputs.map((frame) => frame.record),
    ...(data.page !== undefined && { page: compactStrings(data.page) }),
    catalog: compactCatalogMetadata(data.catalog),
    ...(data.outputLimits !== undefined && { outputLimits: compactStrings(data.outputLimits) }),
    ...(screenshot && { screenshot: imageMetadata(screenshot) }),
  } as JsonRecord : undefined;
  const compactedResult = { ...result, ...(compactedData && { data: compactedData }) } as ActionResult;
  let remainingBytes = Math.max(0, MAX_SNAPSHOT_RESULT_BYTES - envelopeReserveBytes - byteLength(compactedResult));
  for (const frame of frameOutputs) for (const element of frame.elements) {
    const requiredBytes = byteLength(element.value) + Number(frame.retained.length > 0);
    if (requiredBytes > remainingBytes) break;
    frame.retained.push(element.value);
    remainingBytes -= requiredBytes;
  }
  let returnedElementCount = 0;
  let encodedBytes = 0;
  let omittedAttributeCount = 0;
  frameOutputs.forEach((frame) => {
    frame.record.elements = frame.retained;
    const frameBytes = frame.retained.reduce<number>((total, element, index) => total + byteLength(element) + Number(index > 0), 0);
    returnedElementCount += frame.retained.length;
    encodedBytes += frameBytes;
    const frameOmittedAttributeCount = frame.elements.reduce<number>((total, element) => total + element.omittedAttributes, 0);
    omittedAttributeCount += frameOmittedAttributeCount;
    const catalog = recordValue(frame.record.catalog) || {};
    const omitted = Math.max(0, frame.elements.length - frame.retained.length);
    frame.record.catalog = {
      ...catalog, encodedBytes: frameBytes, returnedElementCount: frame.retained.length,
      omittedAttributeCount: Number(catalog.omittedAttributeCount || 0) + frameOmittedAttributeCount,
      truncated: catalog.truncated === true || omitted > 0,
      ...(omitted > 0 && {
        truncationReason: "maxMcpResultBytes", omittedElementCount: Number(catalog.omittedElementCount || 0) + omitted,
      }),
    };
  });
  if (compactedData) {
    const catalog = recordValue(compactedData.catalog) || {};
    const omittedElementCount = Math.max(0, countElements(sourceFrames) - returnedElementCount);
    const totalOmittedElementCount = Number(catalog.omittedElementCount || 0) + omittedElementCount;
    compactedData.catalog = {
      ...catalog, encodedBytes, returnedElementCount,
      omittedAttributeCount: Number(catalog.omittedAttributeCount || 0) + omittedAttributeCount,
      omittedFrameCount: Number(catalog.omittedFrameCount || 0) + Math.max(0, sourceFrames.length - selectedFrames.length),
      truncated: catalog.truncated === true || omittedElementCount > 0,
      ...(omittedElementCount > 0 && { truncationReason: "maxMcpResultBytes", omittedElementCount: totalOmittedElementCount }),
    };
    compactedData.outputLimits = {
      ...(recordValue(compactedData.outputLimits) || {}), mcpResultByteLimit: MAX_SNAPSHOT_RESULT_BYTES,
    };
  }
  return byteLength(compactedResult) <= MAX_SNAPSHOT_RESULT_BYTES
    ? { result: compactedResult, image }
    : fallbackSnapshotResult(compactedResult, compactedData || {}, screenshot, returnedElementCount);
};

export const snapshotResultContent = (result: ActionResult) => {
  const output = compactSnapshotActionResult(result);
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(output.result) },
      ...(output.image ? [output.image] : []),
    ],
    isError: !result.success,
  };
};
