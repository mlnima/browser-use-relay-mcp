import type { ActionRequest } from "../../../../src/types/action.js";
import { ensureDebugger, sendAttachedDebuggerCommand } from "./debugger-session";
import { modifierMask } from "./modifiers";
import { heldModifierMask } from "./held-modifiers";
import { resolvePoint, type ViewportPoint } from "./resolve-point";

type PenState = { point: ViewportPoint; button: string; buttons: number; modifiers: number };
const buttonMasks: Record<string, number> = { left: 1, right: 2, middle: 4, back: 8, forward: 16 };
const active = new Map<number, PenState>();
const clearState = (tabId?: number) => tabId !== undefined && active.delete(tabId);
chrome.debugger.onDetach.addListener((source) => clearState(source.tabId));
chrome.webNavigation.onCommitted.addListener((details) => details.frameId === 0 && clearState(details.tabId));
const buttonFor = (value: unknown) => {
  const button = String(value ?? "left").toLowerCase();
  if (!buttonMasks[button]) throw new Error(`Unsupported pen button "${button}".`);
  return button;
};
const stateFor = (point: ViewportPoint, request: ActionRequest): PenState => ({
  point,
  button: buttonFor(request.params?.button),
  buttons: (() => {
    const value = request.params?.buttons ?? buttonMasks[buttonFor(request.params?.button)];
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > 31 || !(value & buttonMasks[buttonFor(request.params?.button)])) throw new Error("Pen buttons must be a matching integer mask from 1 to 31.");
    return value;
  })(),
  modifiers: modifierMask(request.params?.modifiers),
});

const dispatch = (tabId: number, type: string, point: { x: number; y: number }, request: ActionRequest, state: PenState) => sendAttachedDebuggerCommand(tabId, "Input.dispatchMouseEvent", {
  type,
  ...point,
  pointerType: "pen",
  button: state.button,
  buttons: type === "mouseReleased" ? 0 : state.buttons,
  clickCount: Number(request.params?.clickCount ?? 1),
  force: type === "mouseReleased" ? 0 : Number(request.params?.pressure ?? 0.5),
  tangentialPressure: Number(request.params?.tangentialPressure ?? 0),
  tiltX: Number(request.params?.tiltX ?? 0),
  tiltY: Number(request.params?.tiltY ?? 0),
  twist: Number(request.params?.twist ?? 0),
  modifiers: state.modifiers | heldModifierMask(tabId),
});
const acquirePen = async (tabId: number, point: ViewportPoint, request: ActionRequest, state: PenState, signal?: AbortSignal) => {
  active.set(tabId, state);
  try { await dispatch(tabId, "mousePressed", point, request, state); signal?.throwIfAborted(); }
  catch (error) {
    const released = await dispatch(tabId, "mouseReleased", point, request, state).then(() => true, () => false);
    if (released && active.get(tabId) === state) active.delete(tabId);
    throw error;
  }
};

export const releaseHeldPens = async () => {
  const entries = [...active];
  await Promise.allSettled(entries.map(async ([tabId, state]) => {
    await sendAttachedDebuggerCommand(tabId, "Input.dispatchMouseEvent", {
      type: "mouseReleased", ...state.point, pointerType: "pen", button: state.button,
      buttons: 0, clickCount: 1, force: 0, modifiers: state.modifiers | heldModifierMask(tabId),
    });
    if (active.get(tabId) === state) active.delete(tabId);
  }));
};

export const executePenInput = async (request: ActionRequest, tabId: number, signal?: AbortSignal) => {
  if (request.action !== "pen") return undefined;
  const phase = String(request.params?.phase || "tap");
  if (!["start", "move", "end", "tap"].includes(phase)) throw new Error(`Unsupported pen phase "${phase}".`);
  if ((phase === "move" || phase === "end") !== active.has(tabId)) throw new Error(phase === "move" || phase === "end" ? "No active pen sequence is available." : "A pen sequence is already active.");
  const held = active.get(tabId); const hasPoint = request.target?.elementId !== undefined || request.target?.locator !== undefined || request.target?.x !== undefined || request.target?.y !== undefined;
  const hasDestination = request.params?.toX !== undefined || request.params?.toY !== undefined;
  if (hasDestination && (!(phase === "move" || phase === "end") || hasPoint)) throw new Error("Paired pen toX/toY coordinates are only valid for targetless move or end.");
  if (hasDestination && (typeof request.params?.toX !== "number" || typeof request.params.toY !== "number" || !Number.isFinite(request.params.toX) || !Number.isFinite(request.params.toY))) throw new Error("Pen toX and toY must both be finite numbers.");
  const point = hasDestination
    ? await resolvePoint({ ...request, target: { tabId, frameId: request.target?.frameId, documentId: request.target?.documentId, x: request.params!.toX as number, y: request.params!.toY as number } }, tabId, signal)
    : held && !hasPoint ? held.point : await resolvePoint(request, tabId, signal);
  await ensureDebugger(tabId);
  if (phase === "start") { const state = stateFor(point, request); return (await acquirePen(tabId, point, request, state, signal), point); }
  if (phase === "move") { const state = { ...held!, point }; return (active.set(tabId, state), await dispatch(tabId, "mouseMoved", point, request, state), point); }
  if (phase === "end") {
    await dispatch(tabId, "mouseReleased", point, request, { ...held!, point });
    active.delete(tabId); return point;
  }
  const state = stateFor(point, request);
  await acquirePen(tabId, point, request, state, signal);
  try {
    return point;
  } finally {
    await dispatch(tabId, "mouseReleased", point, request, state);
    active.delete(tabId);
  }
};
