import type { NativePage, NativePageSurface } from "../../types/action.js";
import { createNativeError } from "../nativeError.js";
import { releaseAllNativeInput } from "../nativeInputState.js";
import { nativeBinding } from "../nativeBinding.js";

type Context = { page: NativePage; surface: NativePageSurface; signal: AbortSignal; owner: object; failed: (error: Error) => void };
let current: Context | undefined;
let retained: Context | undefined;
let watchdog: NodeJS.Timeout | undefined;
const held = new Set<string>();
const buttons = new Set<string>();
const revoked = new Set<string>();
const closed = new WeakSet<NativePageSurface>();
const close = (surface: NativePageSurface) => {
  if (closed.has(surface)) return;
  closed.add(surface); surface.confine?.(false); surface.close();
};
const disarm = () => { clearInterval(watchdog); watchdog = undefined; };
const hasHeld = () => held.size > 0 || buttons.size > 0;
const blockedModifier = (surface: NativePageSurface) => surface.keys?.().some((key) =>
  !controls.has(key) && !shifts.has(key) || process.platform === "darwin" && ["control", "right_control"].includes(key));
export const nativePageInputHeld = (observation?: string) => Boolean(observation && retained?.page.observation === observation && hasHeld());
export const revokeNativePage = (observation: string) => revoked.add(observation);
export const releaseNativePage = async (observation: string) => {
  revoked.add(observation);
  if (retained?.page.observation === observation) await releaseAllNativeInput();
};
const releaseRetained = () => {
  if (current || hasHeld() || !retained) return;
  const previous = retained; retained = undefined; disarm(); close(previous.surface);
};
const revoke = async (context: Context, error: Error) => {
  revoked.add(context.page.observation);
  context.failed(error); disarm();
  await releaseAllNativeInput();
  releaseRetained();
};
const arm = () => {
  if (current && retained !== current) {
    retained && close(retained.surface); retained = current;
    if (buttons.size) retained.surface.confine?.(true);
  }
  watchdog ||= setInterval(() => {
    const context = retained;
    if (!context) return disarm();
    try {
      context.surface.verify();
      if (blockedModifier(context.surface)) throw createNativeError("NATIVE_PAGE_SHORTCUT", "An OS shortcut modifier is physically held.");
      if (buttons.size) {
        const point = nativeBinding().getMousePos();
        if (!inside(point, context.surface.rect)) throw createNativeError("NATIVE_PAGE_BOUNDS", "The held pointer left the webpage.");
        context.surface.verify(point);
      }
    } catch (error) {
      void revoke(context, error instanceof Error ? error : new Error("The webpage lost focus.")).catch((failure: unknown) =>
        context.failed(failure instanceof Error ? failure : new Error("Native input could not be released.")));
    }
  }, 16);
};
const scope = () => {
  if (!current) throw createNativeError("NATIVE_PAGE_REQUIRED", "Native input requires a verified foreground webpage.");
  current.signal.throwIfAborted();
  if (revoked.has(current.page.observation)) throw createNativeError("NATIVE_PAGE_CHANGED", "Take a fresh snapshot before continuing native input.");
  current.surface.verify();
  if (blockedModifier(current.surface)) throw createNativeError("NATIVE_PAGE_SHORTCUT", "An OS shortcut modifier is physically held.");
  return current;
};
const inside = (point: { x: number; y: number }, rect: NativePageSurface["rect"]) =>
  point.x >= rect.x && point.y >= rect.y && point.x < rect.x + rect.width && point.y < rect.y + rect.height;
export const nativePagePoint = (point: { x: number; y: number }) => {
  const { page, surface } = scope();
  if (point.x < 0 || point.y < 0 || point.x >= page.width || point.y >= page.height)
    throw createNativeError("NATIVE_PAGE_BOUNDS", "Native coordinates must be inside the visible webpage viewport.");
  return { x: Math.round(surface.rect.x + point.x * surface.rect.width / page.width),
    y: Math.round(surface.rect.y + point.y * surface.rect.height / page.height) };
};
export const assertNativePagePoint = (point: { x: number; y: number }) => {
  const { surface } = scope();
  if (!inside(point, surface.rect)) throw createNativeError("NATIVE_PAGE_BOUNDS", "The native pointer is outside the webpage.");
  surface.verify(point);
};
export const nativePointerInsidePage = (point: { x: number; y: number }) => inside(point, scope().surface.rect);
const controls = new Set(["control", "right_control", ...(process.platform === "darwin" ? ["meta", "right_meta", "cmd", "right_cmd"] : [])]);
const shifts = new Set(["shift", "right_shift"]);
const allowedControlKeys = new Set(["a", "c", "v", "x", "z", "y", "home", "end", "left", "right", "up", "down", "backspace", "delete"]);
export const assertNativePageKeys = (keys: readonly string[], text = false) => {
  scope();
  const combined = new Set([...held, ...keys, ...(current?.surface.keys?.() || [])]);
  const modifiers = [...combined].filter((key) => controls.has(key) || shifts.has(key));
  const ordinary = [...combined].filter((key) => !modifiers.includes(key));
  if (process.platform === "darwin" && [...combined].some((key) => ["control", "right_control"].includes(key)) ||
    modifiers.some((key) => shifts.has(key)) && ordinary.includes("escape") ||
    ordinary.some((key) => !(key.length === 1 || /^numpad_[0-9]$/.test(key) ||
    ["home", "end", "left", "right", "up", "down", "enter", "return", "escape", "space", "backspace", "delete", "insert",
      "pagedown", "pageup", "numpad_decimal", "numpad_equal", "add", "subtract", "multiply", "divide", "clear"].includes(key))) ||
    text && modifiers.some((key) => controls.has(key)) ||
    modifiers.some((key) => controls.has(key)) && ordinary.some((key) => !allowedControlKeys.has(key) || process.platform === "darwin" && key === "y" ||
      modifiers.some((modifier) => shifts.has(modifier)) && !["v", "z", "home", "end", "left", "right", "up", "down", "backspace"].includes(key)))
    throw createNativeError("NATIVE_PAGE_SHORTCUT", "This key or shortcut can leave the webpage. Use programmatic browser actions instead.");
};
export const assertNativePageWheel = () => {
  assertNativePageKeys([]);
  if ([...held, ...(current?.surface.keys?.() || [])].some((key) => controls.has(key)))
    throw createNativeError("NATIVE_PAGE_SHORTCUT", "Modified native scrolling can change browser zoom. Use programmatic zoom instead.");
};
export const nativePageKeysPressed = (keys: readonly string[]) => { keys.forEach((key) => held.add(key)); arm(); };
export const nativePageKeysReleased = (keys: readonly string[]) => { keys.forEach((key) => held.delete(key)); releaseRetained(); };
export const nativePageButtonPressed = (button: string) => { scope().surface.confine?.(true); buttons.add(button); arm(); };
export const nativePageButtonReleased = (button: string) => {
  buttons.delete(button);
  if (!buttons.size) (current || retained)?.surface.confine?.(false);
  releaseRetained();
};

export const withNativePage = async <T>(page: NativePage | undefined, signal: AbortSignal, owner: object, failed: (error: Error) => void, run: () => Promise<T>) => {
  if (!page?.focused || !page.title || ![page.width, page.height, page.zoom].every((value) => Number.isFinite(value) && value > 0))
    throw createNativeError("NATIVE_PAGE_REQUIRED", "Native input requires a focused, measurable webpage.");
  if (revoked.has(page.observation)) throw createNativeError("NATIVE_PAGE_CHANGED", "Take a fresh snapshot before continuing native input.");
  if (retained && hasHeld() && (retained.owner !== owner || retained.page.tabId !== page.tabId || retained.page.observation !== page.observation))
    throw createNativeError("NATIVE_PAGE_HELD", "Held native input belongs to a different webpage observation or client.");
  retained?.surface.verify();
  const surface = process.platform === "win32" ? (await import("./windowsPage.js")).openWindowsPage(page)
    : process.platform === "darwin" ? (await import("./macosPage.js")).openMacosPage(page)
      : process.platform === "linux" ? (await import("./linuxPage.js")).openLinuxPage(page)
        : undefined;
  if (!surface) throw createNativeError("NATIVE_PAGE_UNAVAILABLE", "This OS cannot verify the webpage input area.");
  const sx = surface.rect.width / page.width;
  const sy = surface.rect.height / page.height;
  if (!Number.isFinite(sx) || !Number.isFinite(sy) || sx <= 0 || sy <= 0 || Math.abs(sx / sy - 1) > 0.02) {
    surface.close();
    throw createNativeError("NATIVE_PAGE_GEOMETRY", "The OS webpage area does not match the observed viewport.");
  }
  if (retained && hasHeld() && (retained.surface.id !== surface.id || JSON.stringify(retained.surface.rect) !== JSON.stringify(surface.rect))) {
    close(surface);
    throw createNativeError("NATIVE_PAGE_CHANGED", "The webpage changed while native input was held.");
  }
  current = { page, surface, signal, owner, failed };
  try {
    const result = await run();
    scope();
    if (result && typeof result === "object" && "x" in result && "y" in result &&
      typeof result.x === "number" && typeof result.y === "number")
      return { ...result, x: (result.x - surface.rect.x) / sx, y: (result.y - surface.rect.y) / sy };
    return result;
  } catch (error) {
    revoked.add(page.observation);
    await releaseAllNativeInput();
    throw error;
  } finally {
    if (hasHeld()) arm();
    current = undefined;
    if (!hasHeld()) { releaseRetained(); close(surface); }
  }
};
