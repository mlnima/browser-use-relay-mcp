import koffi from "koffi";
import type { NativePage, NativePageRect, NativePageSurface } from "../../types/action.js";
import { createNativeError } from "../nativeError.js";
import { windowsPageFocused } from "./windowsFocus.js";

const user = koffi.load("user32.dll");
koffi.struct("RelayPagePoint", { x: "int32", y: "int32" });
const Rect = koffi.struct("RelayPageRect", { left: "int32", top: "int32", right: "int32", bottom: "int32" });
const Gui = koffi.struct("RelayPageGui", {
  cbSize: "uint32", flags: "uint32", hwndActive: "uintptr", hwndFocus: "uintptr", hwndCapture: "uintptr",
  hwndMenuOwner: "uintptr", hwndMoveSize: "uintptr", hwndCaret: "uintptr", rcCaret: Rect,
});
const foreground = user.func("uintptr __stdcall GetForegroundWindow()");
const dpiContext = user.func("intptr __stdcall SetThreadDpiAwarenessContext(intptr context)");
const clientRect = user.func("bool __stdcall GetClientRect(uintptr window, _Out_ RelayPageRect *rect)");
const toScreen = user.func("bool __stdcall ClientToScreen(uintptr window, _Inout_ RelayPagePoint *point)");
const find = user.func("uintptr __stdcall FindWindowExW(uintptr parent, uintptr after, str16 className, str16 title)");
const visible = user.func("bool __stdcall IsWindowVisible(uintptr window)");
const parent = user.func("bool __stdcall IsChild(uintptr parent, uintptr child)");
const fromPoint = user.func("uintptr __stdcall WindowFromPoint(RelayPagePoint point)");
const thread = user.func("uint32 __stdcall GetWindowThreadProcessId(uintptr window, void *pid)");
const gui = user.func("bool __stdcall GetGUIThreadInfo(uint32 thread, _Inout_ RelayPageGui *info)");
const windowText = user.func("int __stdcall GetWindowTextW(uintptr window, _Out_ uint16 *text, int length)");
const windowClass = user.func("int __stdcall GetClassNameW(uintptr window, _Out_ uint16 *text, int length)");
const physicalPosition = user.func("bool __stdcall GetPhysicalCursorPos(_Out_ RelayPagePoint *point)");
const setPhysicalPosition = user.func("bool __stdcall SetPhysicalCursorPos(int x, int y)");
const keyState = user.func("int16 __stdcall GetAsyncKeyState(int key)");
const clip = user.func("bool __stdcall ClipCursor(RelayPageRect *rect)");
const fail = (message: string): never => { throw createNativeError("NATIVE_PAGE_UNAVAILABLE", message); };
const physical = <T>(run: () => T) => {
  const previous = dpiContext(-4);
  if (!previous) return fail("Windows per-monitor DPI coordinates are unavailable.");
  try { return run(); } finally { dpiContext(previous); }
};
const region = (window: number): NativePageRect => physical(() => {
  const rect = { left: 0, top: 0, right: 0, bottom: 0 };
  const origin = { x: 0, y: 0 };
  if (!clientRect(window, rect) || !toScreen(window, origin)) return fail("The webpage surface is unavailable.");
  return { ...origin, width: rect.right, height: rect.bottom };
});
const title = (window: number) => {
  const text = Buffer.alloc(8192);
  const length = windowText(window, text, text.length / 2);
  return text.toString("utf16le", 0, length * 2);
};
const focus = (window: number) => {
  const info = { cbSize: koffi.sizeof(Gui), flags: 0, hwndActive: 0, hwndFocus: 0, hwndCapture: 0,
    hwndMenuOwner: 0, hwndMoveSize: 0, hwndCaret: 0, rcCaret: { left: 0, top: 0, right: 0, bottom: 0 } };
  if (!gui(thread(window, null), info) || info.flags & 0x1e) return fail("Browser menus or window controls have focus.");
  return info.hwndFocus;
};
const same = (a: NativePageRect, b: NativePageRect) =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
const renderer = (window: number, focused: number, depth = 0): number | undefined => {
  if (depth > 6) return undefined;
  for (let child = find(window, 0, null, null); child; child = find(window, child, null, null)) {
    if (!visible(child)) continue;
    const name = Buffer.alloc(512);
    const length = windowClass(child, name, name.length / 2);
    if (name.toString("utf16le", 0, length * 2) === "Chrome_RenderWidgetHostHWND" &&
      (focused === window || focused === child || parent(child, focused))) return child;
    const nested = renderer(child, focused, depth + 1);
    if (nested) return nested;
  }
  return undefined;
};

export const openWindowsPage = (page: NativePage): NativePageSurface => {
  const window = foreground();
  if (!window || !page.focused || !title(window).startsWith(page.title)) return fail("The requested webpage is not foreground.");
  const child = renderer(window, focus(window));
  if (!child) return fail("Keyboard focus is outside the webpage surface.");
  const rect = region(child);
  if (rect.width <= 0 || rect.height <= 0) return fail("The webpage has no visible input area.");
  if (!windowsPageFocused(child)) return fail("Keyboard focus is outside the webpage.");
  let confined = false;
  return {
    id: `${window}:${child}`, rect, close: () => undefined,
    confine: (enabled) => physical(() => {
      if (!enabled && !confined) return;
      if (!clip(enabled ? { left: rect.x, top: rect.y, right: rect.x + rect.width, bottom: rect.y + rect.height } : null))
        return fail("Windows cannot confine the drag to the webpage.");
      confined = enabled;
    }),
    keys: () => [[0x11, "control"], [0x10, "shift"]].filter(([key]) => keyState(key) < 0).map(([, name]) => String(name)),
    verify: (point) => {
      if (foreground() !== window || !title(window).startsWith(page.title) || !visible(child) ||
        !same(rect, region(child)) || !windowsPageFocused(child))
        return fail("The webpage moved, resized, or lost focus. Take a fresh snapshot before continuing.");
      focus(window);
      if (point && physical(() => { const hit = fromPoint(point); return hit !== child && !parent(child, hit); }))
        return fail("The pointer target is covered or outside the webpage surface.");
      if ([0x12, 0x5b, 0x5c].some((key) => keyState(key) < 0))
        return fail("An OS shortcut modifier is physically held.");
    },
  };
};

export const windowsMousePosition = () => physical(() => {
  const point = { x: 0, y: 0 };
  if (!physicalPosition(point)) return fail("Windows cursor position is unavailable.");
  return point;
});
export const moveWindowsMouse = (point: { x: number; y: number }) => physical(() => {
  if (!setPhysicalPosition(point.x, point.y)) return fail("Windows cursor movement failed.");
});
