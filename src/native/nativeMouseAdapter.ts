import { abortableDelay, throwIfAborted } from "./nativeError.js";
import { nativeBinding } from "./nativeBinding.js";
import type { NativeButton } from "./nativeButtons.js";

export type NativePoint = { x: number; y: number };
const config = { autoDelayMs: 0, mouseSpeed: 1000 };
const setPosition = async (point: NativePoint) => {
  nativeBinding().moveMouse(point.x, point.y);
};
const move = async (target: NativePoint, signal: AbortSignal) => {
  const origin = nativeBinding().getMousePos();
  const distance = Math.hypot(target.x - origin.x, target.y - origin.y);
  const durationMs = config.mouseSpeed > 0 ? distance * 1000 / config.mouseSpeed : 0;
  const steps = Math.max(1, Math.min(2048, Math.ceil(distance), Math.ceil(durationMs / 8)));
  const started = performance.now();
  for (let index = 1; index <= steps; index += 1) {
    throwIfAborted(signal);
    const waitMs = durationMs * index / steps - (performance.now() - started);
    if (waitMs > 0) await abortableDelay(waitMs, signal);
    await setPosition({
      x: Math.round(origin.x + (target.x - origin.x) * index / steps),
      y: Math.round(origin.y + (target.y - origin.y) * index / steps),
    });
  }
};
const prepare = () => nativeBinding().setMouseDelay(0);

export const mouse = {
  config,
  setPosition,
  getPosition: async () => nativeBinding().getMousePos(),
  move,
  click: async (button: NativeButton) => { prepare(); nativeBinding().mouseClick(button); },
  doubleClick: async (button: NativeButton) => { prepare(); nativeBinding().mouseClick(button, true); },
  pressButton: async (button: NativeButton) => { prepare(); nativeBinding().mouseToggle("down", button); },
  releaseButton: async (button: NativeButton) => { prepare(); nativeBinding().mouseToggle("up", button); },
  scrollUp: async (amount: number) => nativeBinding().scrollMouse(0, amount),
  scrollDown: async (amount: number) => nativeBinding().scrollMouse(0, -amount),
  scrollLeft: async (amount: number) => nativeBinding().scrollMouse(-amount, 0),
  scrollRight: async (amount: number) => nativeBinding().scrollMouse(amount, 0),
};
