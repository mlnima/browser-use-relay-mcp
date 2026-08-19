import type { JsonValue } from "../../../../src/types/json.js";
import type { ContentActionHandler } from "./types.js";
import { isElementEnabled } from "../catalog/element-state.js";
import { dispatchValueEvents, requireElement, requireInput } from "./element";

const decode = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

const createFiles = (value: JsonValue | undefined) => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Invalid file payload.");
    const bytes = decode(String(item.base64 ?? ""));
    return new File([bytes], String(item.name ?? "file"), { type: String(item.mimeType ?? "application/octet-stream") });
  });
};
const requiredFiles = (value: JsonValue | undefined, exactOne: boolean) => {
  if (!Array.isArray(value) || !value.length) throw new Error(`${exactOne ? "dropFile" : "dropFiles"} requires a non-empty params.files array.`);
  if (exactOne && value.length !== 1) throw new Error("dropFile requires exactly one file payload.");
  return createFiles(value);
};

const transferFiles = (files: File[]) => {
  const transfer = new DataTransfer();
  files.forEach((file) => transfer.items.add(file));
  return transfer;
};
const requireFileInput = (target?: Element) => {
  const input = requireInput(target);
  if (input.type !== "file") throw new Error("The target must be a file input.");
  if (!isElementEnabled(input)) throw new Error("The target file input is disabled.");
  return input;
};
const matchesFiles = (list: FileList | null, files: File[]) => list?.length === files.length && files.every((file, index) => {
  const observed = list.item(index); return observed?.name === file.name && observed.size === file.size && observed.type === file.type;
});

const dispatchFileDrop = (element: Element, files: File[]) => {
  const dataTransfer = transferFiles(files);
  const bounds = element.getBoundingClientRect();
  const options = { bubbles: true, cancelable: true, composed: true, dataTransfer, clientX: bounds.x + bounds.width / 2, clientY: bounds.y + bounds.height / 2 };
  const dragenterCancelled = !element.dispatchEvent(new DragEvent("dragenter", options));
  const accepted = !element.dispatchEvent(new DragEvent("dragover", options));
  const dropCancelled = accepted ? !element.dispatchEvent(new DragEvent("drop", options)) : false;
  const dragleaveDispatched = !accepted;
  const dragleaveCancelled = dragleaveDispatched ? !element.dispatchEvent(new DragEvent("dragleave", options)) : false;
  const dragendCancelled = !element.dispatchEvent(new DragEvent("dragend", options));
  return { count: files.length, dragenterCancelled, accepted, dropDispatched: accepted, dropCancelled, dragleaveDispatched, dragleaveCancelled, dragendCancelled };
};

export const fileActionHandlers: Record<string, ContentActionHandler> = {
  setInputFiles: async ({ target, request }) => {
    const input = requireFileInput(target);
    const supplied = request.params?.files;
    if (!Array.isArray(supplied) || !supplied.length) throw new Error("setInputFiles requires a non-empty params.files array.");
    const files = createFiles(supplied);
    if (!input.multiple && files.length > 1) throw new Error("The target file input does not accept multiple files.");
    input.files = transferFiles(files).files;
    if (!matchesFiles(input.files, files)) throw new Error("The target file input did not accept the requested files.");
    dispatchValueEvents(input);
    if (!matchesFiles(input.files, files)) throw new Error("The target file input did not retain the requested files.");
    return { count: input.files?.length ?? 0 };
  },
  clearFiles: async ({ target }) => {
    const input = requireFileInput(target);
    input.value = "";
    dispatchValueEvents(input);
    if (input.value || input.files?.length) throw new Error("The target file input did not clear its FileList.");
    return { count: input.files?.length ?? 0 };
  },
  dropFile: async ({ target, request }) => {
    return dispatchFileDrop(requireElement(target), requiredFiles(request.params?.files, true));
  },
  dropFiles: async ({ target, request }) => {
    return dispatchFileDrop(requireElement(target), requiredFiles(request.params?.files, false));
  },
};
