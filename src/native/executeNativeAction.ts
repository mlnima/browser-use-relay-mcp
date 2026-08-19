import type { ActionRequest } from "../types/action.js";
import type { JsonValue } from "../types/json.js";
import {
  clipboardActions, compoundActions, dialogActions, keyboardActions, pointerClickActions,
  pointerDragActions, pointerMoveActions, scrollActions, textActions,
} from "./nativeActionNames.js";
import { executeNativeClipboard } from "./nativeClipboard.js";
import { executeNativeCompound } from "./nativeCompound.js";
import { executeNativeDialog } from "./nativeDialogs.js";
import { executeNativeDownloadTransfer, isDownloadTransferRequest } from "./nativeDownloadTransfer.js";
import { createNativeError, throwIfAborted } from "./nativeError.js";
import { executeNativeFileOpen } from "./nativeFileOpen.js";
import { nativeInputDuration } from "./nativeInputLimits.js";
import { executeNativeKeyboard } from "./nativeKeyboard.js";
import { moveNativePointer } from "./nativeMouse.js";
import { mouse } from "./nativeMouseAdapter.js";
import { executeNativePointerClick } from "./nativePointerClick.js";
import { executeNativePointerDrag } from "./nativePointerDrag.js";
import { executeNativeScroll } from "./nativeScroll.js";
import { executeNativeTextEditing } from "./nativeTextEditing.js";
import { executeNativeUploadTransfer, isUploadTransferRequest } from "./nativeUploadTransfer.js";

export const canExecuteNativeAction = (request: ActionRequest) =>
  isUploadTransferRequest(request) || isDownloadTransferRequest(request) ||
  pointerMoveActions.has(request.action) || pointerClickActions.has(request.action) ||
  pointerDragActions.has(request.action) || scrollActions.has(request.action) ||
  keyboardActions.has(request.action) || textActions.has(request.action) ||
  clipboardActions.has(request.action) || dialogActions.has(request.action) ||
  compoundActions.has(request.action) || ["openDownload", "revealDownload"].includes(request.action);

export const executeNativeAction = async (
  request: ActionRequest,
  signal: AbortSignal,
  owner: object,
): Promise<JsonValue | undefined> => {
  throwIfAborted(signal);
  if (!canExecuteNativeAction(request))
    throw createNativeError("NATIVE_ACTION_UNAVAILABLE", `Native action "${request.action}" is not available on this host.`);
  let result: JsonValue | undefined;
  if (isUploadTransferRequest(request)) result = await executeNativeUploadTransfer(request, signal, owner);
  else if (isDownloadTransferRequest(request)) result = await executeNativeDownloadTransfer(request, signal, owner);
  else if (pointerMoveActions.has(request.action)) {
    const durationValue = request.params?.durationMs;
    if (durationValue !== undefined && durationValue !== null) nativeInputDuration(durationValue, 0, "Pointer durationMs");
    if (request.action === "unhover" && request.target?.x === undefined && request.target?.y === undefined &&
      request.params?.x === undefined && request.params?.y === undefined) {
      await mouse.setPosition({ x: 0, y: 0 });
      result = { x: 0, y: 0 };
    } else {
      result = await moveNativePointer(request, signal);
    }
  }
  else if (pointerClickActions.has(request.action)) result = await executeNativePointerClick(request, signal);
  else if (pointerDragActions.has(request.action)) result = await executeNativePointerDrag(request, signal);
  else if (scrollActions.has(request.action)) result = await executeNativeScroll(request, signal);
  else if (keyboardActions.has(request.action)) result = await executeNativeKeyboard(request, signal);
  else if (textActions.has(request.action)) result = await executeNativeTextEditing(request, signal);
  else if (clipboardActions.has(request.action)) result = await executeNativeClipboard(request, signal);
  else if (["openDownload", "revealDownload"].includes(request.action)) result = await executeNativeFileOpen(request);
  else if (dialogActions.has(request.action)) result = await executeNativeDialog(request, signal);
  else if (compoundActions.has(request.action)) result = await executeNativeCompound(request, signal);
  else throw createNativeError("NATIVE_ACTION_UNAVAILABLE", `Native action "${request.action}" has no matching handler.`);
  throwIfAborted(signal);
  return result;
};
