import { abortableDelay, throwIfAborted } from "./nativeError.js";
import { nativeBinding } from "./nativeBinding.js";
import type { NativeButton } from "./nativeButtons.js";
import { assertNativePagePoint, nativePointerInsidePage, nativePageButtonPressed, nativePageButtonReleased, assertNativePageWheel, assertNativePageKeys } from "./page/nativePageScope.js";

export type NativePoint = { x: number; y: number };
const config = { autoDelayMs: 0, mouseSpeed: 1000 };
const setPosition = async (point: NativePoint) => {
  assertNativePagePoint(point);
  nativeBinding().moveMouse(point.x, point.y);
  const actual = nativeBinding().getMousePos();
  assertNativePagePoint(actual);
  if (Math.hypot(actual.x - point.x, actual.y - point.y) > 1.5) throw new Error("Native pointer movement did not reach the webpage target.");
};
const move = async (target: NativePoint, signal: AbortSignal) => {
  const origin = nativeBinding().getMousePos();
  if (!nativePointerInsidePage(origin)) return setPosition(target);
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
const prepare = () => { assertNativePagePoint(nativeBinding().getMousePos()); assertNativePageKeys([]); nativeBinding().setMouseDelay(0); };
const scroll = (x: number, y: number) => { prepare(); assertNativePageWheel(); nativeBinding().scrollMouse(x, y); };

export const mouse = {
  config,
  setPosition,
  getPosition: async () => nativeBinding().getMousePos(),
  move,
  click: async (button: NativeButton) => { prepare(); nativeBinding().mouseClick(button); },
  doubleClick: async (button: NativeButton) => { prepare(); nativeBinding().mouseClick(button); prepare(); nativeBinding().mouseClick(button); },
  pressButton: async (button: NativeButton) => {
    prepare(); nativePageButtonPressed(button);
    try { nativeBinding().mouseToggle("down", button); } catch (error) { nativePageButtonReleased(button); throw error; }
  },
  releaseButton: async (button: NativeButton) => {
    nativeBinding().setMouseDelay(0); nativeBinding().mouseToggle("up", button); nativePageButtonReleased(button);
  },
  scrollUp: async (amount: number) => scroll(0, amount),
  scrollDown: async (amount: number) => scroll(0, -amount),
  scrollLeft: async (amount: number) => scroll(-amount, 0),
  scrollRight: async (amount: number) => scroll(amount, 0),
};
