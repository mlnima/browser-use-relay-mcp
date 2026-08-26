import type { ActionRequest, ActionTarget } from "../../../../src/types/action.js";
import { sendAttachedDebuggerCommand, sendDebuggerCommand } from "./debugger-session";
import { modifierMask } from "./modifiers";
import { heldModifierMask } from "./held-modifiers";
import { resolvePoint, type ViewportPoint } from "./resolve-point";
import { abortableDelay, assertInputDuration, inputDuration } from "./abortable-delay";
import { activeMouseDrag, clearMouseState, heldMouseButtonMask, holdMouseDrag, latestMouseButton, mouseButtonMask, mousePosition, pressMouseButton, releaseHeldMouseButton, releaseMouseButton, setMousePosition, takeHeldMouseState } from "./mouse-state";
const mouseActions = new Set(["move", "moveTo", "hover", "unhover", "mouseDown", "mouseUp", "leftClick", "middleClick", "rightClick", "doubleClick", "tripleClick", "clickAndHold", "release", "longPress", "contextMenu", "modifierClick", "dragStart", "dragMove", "dragEnd", "dragAndDrop", "dragToElement", "dragToCoordinates", "dragScrollbar", "dragSlider", "selectTextByDragging"]);
const buttonFor = (action: string, requested: unknown) => {
  const button = requested ? String(requested) : /right|context/i.test(action) ? "right" : /middle/i.test(action) ? "middle" : "left";
  if (!["left", "right", "middle", "back", "forward"].includes(button)) throw new Error(`Unsupported mouse button "${button}".`);
  return button;
};
chrome.debugger.onDetach.addListener((source) => clearMouseState(source.tabId));
chrome.webNavigation.onCommitted.addListener((details) => details.frameId === 0 && clearMouseState(details.tabId));
export const releaseHeldMouse = async () => {
  await Promise.allSettled(takeHeldMouseState().map(async ({ tabId, buttons, point, drag }) => {
    let mask = buttons.reduce((value, button) => value | mouseButtonMask(button), 0);
    for (const button of buttons.reverse()) {
      const nextMask = mask & ~mouseButtonMask(button);
      const released = point ? await sendAttachedDebuggerCommand(tabId, "Input.dispatchMouseEvent", {
        type: "mouseReleased", ...point, button, buttons: nextMask, clickCount: 1,
        modifiers: drag?.button === button ? drag.modifiers | heldModifierMask(tabId) : heldModifierMask(tabId),
      }).then(() => true, () => false) : false;
      if (released) { mask = nextMask; releaseMouseButton(tabId, button); }
    }
  }));
};
const move = async (tabId: number, target: ViewportPoint, duration = 180, modifiers = 0, signal?: AbortSignal, dragButton?: string) => {
  const start = mousePosition(tabId) || target;
  const steps = Math.max(1, Math.min(60, Math.round(duration / 12)));
  const curve = (Math.random() - 0.5) * Math.min(24, Math.hypot(target.x - start.x, target.y - start.y) / 10);
  for (let index = 1; index <= steps; index += 1) {
    signal?.throwIfAborted();
    const progress = index / steps;
    const eased = progress * progress * (3 - 2 * progress);
    const offset = Math.sin(Math.PI * progress) * curve;
    const x = start.x + (target.x - start.x) * eased + offset;
    const y = start.y + (target.y - start.y) * eased - offset / 2;
    const held = dragButton || latestMouseButton(tabId);
    await sendDebuggerCommand(tabId, "Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: held || "none", buttons: heldMouseButtonMask(tabId), modifiers });
    setMousePosition(tabId, { x, y });
    if (duration > 0) await abortableDelay(duration / steps, signal);
  }
  setMousePosition(tabId, target);
};
export const executeMouseInput = async (request: ActionRequest, tabId: number, signal?: AbortSignal) => {
  if (!mouseActions.has(request.action)) return undefined;
  const continuingDrag = request.action === "dragMove" || request.action === "dragEnd"; const activeDrag = activeMouseDrag(tabId);
  if (request.action === "dragStart" && (activeDrag || latestMouseButton(tabId))) throw new Error("A browser pointer button is already held.");
  if (continuingDrag && !activeDrag) throw new Error("No browser drag is active in this tab.");
  const releasing = ["mouseUp", "release", "dragEnd"].includes(request.action);
  const requestedButton = continuingDrag || request.params?.button === undefined ? undefined : buttonFor(request.action, request.params.button);
  const button = continuingDrag ? activeDrag!.button : releasing ? requestedButton || latestMouseButton(tabId) || buttonFor(request.action, undefined) : requestedButton || buttonFor(request.action, undefined);
  const acquiring = !releasing && !["move", "moveTo", "hover", "unhover", "dragMove"].includes(request.action);
  if (acquiring && (heldMouseButtonMask(tabId) & mouseButtonMask(button))) throw new Error(`Browser pointer button "${button}" is already held.`);
  const hasPointTarget = request.target?.elementId !== undefined || request.target?.locator !== undefined || request.target?.x !== undefined || request.target?.y !== undefined;
  const point = request.action === "unhover" ? { x: -1, y: -1 }
    : releasing && !hasPointTarget ? mousePosition(tabId) : await resolvePoint(request, tabId, signal);
  if (!point) throw new Error("No held browser pointer position is available to release.");
  const requestedModifiers = modifierMask(request.params?.modifiers);
  const modifiers = (continuingDrag ? activeDrag?.modifiers || 0 : requestedModifiers) | heldModifierMask(tabId);
  const movementDuration = inputDuration(request.params?.durationMs, 180, "durationMs");
  const count = request.action === "doubleClick" ? 2 : request.action === "tripleClick" ? 3 : 1;
  const dragging = ["dragAndDrop", "dragToElement", "dragToCoordinates", "dragScrollbar", "dragSlider", "selectTextByDragging"].includes(request.action);
  const dragDuration = dragging ? inputDuration(request.params?.durationMs, 420, "durationMs") : 0; const holdDuration = request.action === "longPress" ? inputDuration(request.params?.durationMs, 750, "durationMs") : 0;
  const clickInterval = count > 1 ? inputDuration(request.params?.clickIntervalMs, 90, "clickIntervalMs") : 0;
  assertInputDuration(movementDuration + dragDuration + holdDuration + clickInterval * (count - 1), "Mouse action duration");
  await move(tabId, point, movementDuration, modifiers, signal, continuingDrag ? activeDrag?.button : undefined);
  if (["move", "moveTo", "hover", "unhover", "dragMove"].includes(request.action)) return point;
  if (request.action === "dragStart") {
    await pressMouseButton(tabId, point, button, count, modifiers, signal); holdMouseDrag(tabId, button, requestedModifiers, point);
    return point;
  }
  if (["mouseDown", "clickAndHold"].includes(request.action)) return (await pressMouseButton(tabId, point, button, count, modifiers, signal), point);
  if (["mouseUp", "release", "dragEnd"].includes(request.action)) return (await releaseHeldMouseButton(tabId, point, button, count, modifiers, signal), point);
  if (dragging) {
    const destinationTarget = request.params?.destination && typeof request.params.destination === "object" && !Array.isArray(request.params.destination) ? request.params.destination as unknown as ActionTarget : undefined;
    const routing = destinationTarget?.frameId === undefined && destinationTarget?.documentId === undefined ? { frameId: request.target?.frameId, documentId: request.target?.documentId } : {};
    const destination = destinationTarget
      ? await resolvePoint({ ...request, target: { tabId, ...routing, ...destinationTarget } }, tabId, signal)
      : await resolvePoint({ ...request, target: { tabId, frameId: request.target?.frameId, documentId: request.target?.documentId, x: Number(request.params?.toX ?? point.x), y: Number(request.params?.toY ?? point.y) } }, tabId, signal);
    await pressMouseButton(tabId, point, button, 1, modifiers, signal);
    try {
      await move(tabId, destination, dragDuration, modifiers, signal);
    } finally {
      await releaseHeldMouseButton(tabId, mousePosition(tabId) || point, button, 1, modifiers, signal);
    }
    return destination;
  }
  for (let click = 1; click <= count; click += 1) {
    await pressMouseButton(tabId, point, button, click, modifiers, signal);
    try {
      if (holdDuration > 0) await abortableDelay(holdDuration, signal);
    } finally {
      await releaseHeldMouseButton(tabId, point, button, click, modifiers, signal);
    }
    if (click < count) await abortableDelay(clickInterval, signal);
  }
  return point; };
