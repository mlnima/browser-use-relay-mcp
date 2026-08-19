import type { ActionRequest } from "../../../../src/types/action.js";
import { sendDebuggerCommand } from "./debugger-session";
import { resolvePoint } from "./resolve-point";
import { abortableDelay, inputCount, inputDuration, inputNumber } from "./abortable-delay";
import { heldModifierMask } from "./held-modifiers";
import { modifierMask } from "./modifiers";

const wheelActions = new Set(["scrollUp", "scrollDown", "scrollLeft", "scrollRight", "scrollBy", "wheel"]);

export const executeWheelInput = async (request: ActionRequest, tabId: number, signal?: AbortSignal) => {
  if (!wheelActions.has(request.action)) return undefined;
  signal?.throwIfAborted();
  const point = request.target ? await resolvePoint(request, tabId, signal) : { x: 0, y: 0 };
  const amount = inputNumber(request.params?.amount, 600, "amount");
  const deltaX = request.action === "scrollLeft" ? -amount
    : request.action === "scrollRight" ? amount
      : inputNumber(request.params?.x ?? request.params?.deltaX, 0, "deltaX");
  const deltaY = request.action === "scrollUp" ? -amount
    : request.action === "scrollDown" ? amount
      : inputNumber(request.params?.y ?? request.params?.deltaY, 0, "deltaY");
  const smooth = request.params?.behavior === "smooth" || request.params?.smooth === true;
  const steps = inputCount(request.params?.steps, smooth ? 12 : 1, "steps");
  const duration = smooth ? inputDuration(request.params?.durationMs, 240, "durationMs") : 0;
  const modifiers = modifierMask(request.params?.modifiers) | heldModifierMask(tabId);
  for (let index = 0; index < steps; index += 1) {
    signal?.throwIfAborted();
    await sendDebuggerCommand(tabId, "Input.dispatchMouseEvent", { type: "mouseWheel", ...point, deltaX: deltaX / steps, deltaY: deltaY / steps, modifiers });
    if (smooth) await abortableDelay(duration / steps, signal);
  }
  return { deltaX, deltaY };
};
