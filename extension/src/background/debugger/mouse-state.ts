import type { ViewportPoint } from "./resolve-point.js";
import { sendDebuggerCommand } from "./debugger-session.js";

const positions = new Map<number, ViewportPoint>();
const buttons = new Map<number, string[]>();
const drags = new Map<number, { button: string; modifiers: number; source: ViewportPoint }>();
export const mouseButtonMask = (button?: string) => button === "left" ? 1 : button === "right" ? 2
  : button === "middle" ? 4 : button === "back" ? 8 : button === "forward" ? 16 : 0;
export const mousePosition = (tabId: number) => positions.get(tabId);
export const setMousePosition = (tabId: number, point: ViewportPoint) => positions.set(tabId, point);
export const latestMouseButton = (tabId: number) => buttons.get(tabId)?.at(-1);
export const activeMouseDrag = (tabId: number) => drags.get(tabId);
export const holdMouseDrag = (tabId: number, button: string, modifiers: number, source: ViewportPoint) =>
  drags.set(tabId, { button, modifiers, source });
export const heldMouseButtonMask = (tabId: number) => (buttons.get(tabId) || [])
  .reduce((mask, button) => mask | mouseButtonMask(button), 0);
export const holdMouseButton = (tabId: number, button: string) => {
  const held = (buttons.get(tabId) || []).filter((value) => value !== button);
  held.push(button);
  buttons.set(tabId, held);
};
export const releaseMouseButton = (tabId: number, button: string) => {
  const held = (buttons.get(tabId) || []).filter((value) => value !== button);
  if (held.length) buttons.set(tabId, held);
  else buttons.delete(tabId);
  if (drags.get(tabId)?.button === button) drags.delete(tabId);
};
export const clearMouseState = (tabId?: number) => {
  if (tabId === undefined) return;
  positions.delete(tabId);
  buttons.delete(tabId);
  drags.delete(tabId);
};
export const takeHeldMouseState = () => {
  return [...buttons].map(([tabId, held]) => ({ tabId, buttons: [...held], point: positions.get(tabId), drag: drags.get(tabId) }));
};
export const pressMouseButton = async (tabId: number, point: ViewportPoint, button: string, clickCount: number, modifiers: number, signal?: AbortSignal) => {
  if (heldMouseButtonMask(tabId) & mouseButtonMask(button))
    throw new Error(`Browser pointer button "${button}" is already held.`);
  holdMouseButton(tabId, button);
  try {
    await sendDebuggerCommand(tabId, "Input.dispatchMouseEvent", {
      type: "mousePressed", ...point, button, buttons: heldMouseButtonMask(tabId), clickCount, modifiers,
    });
    signal?.throwIfAborted();
  } catch (error) {
    const released = await sendDebuggerCommand(tabId, "Input.dispatchMouseEvent", {
      type: "mouseReleased", ...point, button, buttons: heldMouseButtonMask(tabId) & ~mouseButtonMask(button), clickCount, modifiers,
    }).then(() => true, () => false);
    released && releaseMouseButton(tabId, button);
    throw error;
  }
};
export const releaseHeldMouseButton = async (tabId: number, point: ViewportPoint, button: string, clickCount: number, modifiers: number) => {
  const dispatch = () => sendDebuggerCommand(tabId, "Input.dispatchMouseEvent", {
    type: "mouseReleased", ...point, button, buttons: heldMouseButtonMask(tabId) & ~mouseButtonMask(button), clickCount, modifiers,
  });
  try { await dispatch(); }
  catch (error) {
    const released = await dispatch().then(() => true, () => false);
    released && releaseMouseButton(tabId, button);
    throw error;
  }
  releaseMouseButton(tabId, button);
};
