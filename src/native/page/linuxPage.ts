import koffi from "koffi";
import type { NativePage, NativePageRect, NativePageSurface } from "../../types/action.js";
import { createNativeError } from "../nativeError.js";
import { nativeBinding } from "../nativeBinding.js";

const spi = koffi.load("libatspi.so.0");
const glib = koffi.load("libglib-2.0.so.0");
const object = koffi.load("libgobject-2.0.so.0");
const init = spi.func("int atspi_init()");
const desktop = spi.func("void *atspi_get_desktop(int index)");
const count = spi.func("int atspi_accessible_get_child_count(void *element, void *error)");
const child = spi.func("void *atspi_accessible_get_child_at_index(void *element, int index, void *error)");
const getName = spi.func("void *atspi_accessible_get_name(void *element, void *error)");
const getRole = spi.func("void *atspi_accessible_get_role_name(void *element, void *error)");
const getStates = spi.func("void *atspi_accessible_get_state_set(void *element)");
const state = spi.func("bool atspi_state_set_contains(void *states, int state)");
const component = spi.func("void *atspi_accessible_get_component_iface(void *element)");
const extents = spi.func("void *atspi_component_get_extents(void *component, int coordinates, void *error)");
const atPoint = spi.func("void *atspi_component_get_accessible_at_point(void *component, int x, int y, int coordinates, void *error)");
const getParent = spi.func("void *atspi_accessible_get_parent(void *element, void *error)");
const unref = object.func("void g_object_unref(void *object)");
const free = glib.func("void g_free(void *pointer)");
const Rect = koffi.struct("RelayAtspiRect", { x: "int", y: "int", width: "int", height: "int" });
const x11 = koffi.load("libX11.so.6");
const openDisplay = x11.func("void *XOpenDisplay(str name)");
const closeDisplay = x11.func("int XCloseDisplay(void *display)");
const rootWindow = x11.func("unsigned long XDefaultRootWindow(void *display)");
const translate = x11.func("int XTranslateCoordinates(void *display, unsigned long source, unsigned long destination, int x, int y, _Out_ int *destinationX, _Out_ int *destinationY, _Out_ unsigned long *child)");
const queryKeys = x11.func("int XQueryKeymap(void *display, _Out_ char *keys)");
const keyCode = x11.func("uint8 XKeysymToKeycode(void *display, unsigned long symbol)");
const fail = (message: string): never => { throw createNativeError("NATIVE_PAGE_UNAVAILABLE", message); };
const string = (pointer: unknown) => {
  if (!pointer) return "";
  try { return koffi.decode.string(pointer); } finally { free(pointer); }
};
const showing = (element: unknown) => {
  const states = getStates(element);
  if (!states) return false;
  try { return state(states, 25); } finally { unref(states); }
};
const findPage = (element: unknown, page: NativePage, budget: { remaining: number }, depth = 0): unknown => {
  if (--budget.remaining < 0 || depth > 32) return undefined;
  if (showing(element) && string(getRole(element, null)) === "document web" && string(getName(element, null)) === page.title) {
    const bounds = region(element);
    const window = nativeBinding().getWindowRect(nativeBinding().getActiveWindow());
    if (bounds.x >= window.x && bounds.y >= window.y && bounds.x + bounds.width <= window.x + window.width &&
      bounds.y + bounds.height <= window.y + window.height) return element;
  }
  for (let index = 0, length = count(element, null); index < length; index += 1) {
    const next = child(element, index, null);
    if (!next) continue;
    const found = findPage(next, page, budget, depth + 1);
    if (found === next) return found;
    unref(next);
    if (found) return found;
  }
  return undefined;
};
const region = (web: unknown): NativePageRect => {
  const iface = component(web);
  if (!iface) return fail("The Linux webpage component is unavailable.");
  const pointer = extents(iface, 0, null);
  try {
    if (!pointer) return fail("The Linux webpage geometry is unavailable.");
    return koffi.decode(pointer, Rect) as NativePageRect;
  } finally { pointer && free(pointer); unref(iface); }
};
const contains = (web: unknown, point: { x: number; y: number }) => {
  const iface = component(web);
  let hit = atPoint(iface, point.x, point.y, 0, null);
  unref(iface);
  for (let depth = 0; hit && depth < 64; depth += 1) {
    const same = koffi.address(hit) === koffi.address(web);
    const next = same ? undefined : getParent(hit, null);
    unref(hit);
    if (same) return true;
    hit = next;
  }
  hit && unref(hit);
  return false;
};
const focused = (element: unknown, budget = { remaining: 10000 }, depth = 0): boolean => {
  if (--budget.remaining < 0 || depth > 64 || !showing(element)) return false;
  const states = getStates(element);
  if (states) {
    const active = state(states, 12);
    unref(states);
    if (active) return true;
  }
  for (let index = 0, length = count(element, null); index < length; index += 1) {
    const next = child(element, index, null);
    if (!next) continue;
    const active = focused(next, budget, depth + 1);
    unref(next);
    if (active) return true;
  }
  return false;
};
const pointerWindow = (display: unknown, active: number, point: { x: number; y: number }) => {
  const root = rootWindow(display);
  let window = root;
  for (let depth = 0; depth < 64; depth += 1) {
    if (window === active) return true;
    const next = [0];
    if (!translate(display, root, window, point.x, point.y, [0], [0], next) || !next[0]) return false;
    window = next[0];
  }
  return false;
};

export const openLinuxPage = (page: NativePage): NativePageSurface => {
  if (process.env.XDG_SESSION_TYPE === "wayland" || ![0, 1].includes(init()))
    return fail("Page-confined native input requires X11 and AT-SPI browser accessibility.");
  const active = nativeBinding().getActiveWindow();
  const root = desktop(0);
  const web = root && findPage(root, page, { remaining: 10000 });
  root && unref(root);
  if (!web || !page.focused) { web && unref(web); return fail("The foreground webpage is unavailable through Linux accessibility."); }
  const display = openDisplay(null);
  if (!display) { unref(web); return fail("The X11 display is unavailable."); }
  let rect: NativePageRect;
  try { rect = region(web); } catch (error) { unref(web); closeDisplay(display); throw error; }
  return {
    id: `${active}:${koffi.address(web)}`, rect, close: () => { unref(web); closeDisplay(display); },
    keys: () => {
      const bytes = Buffer.alloc(32); queryKeys(display, bytes);
      return [[0xffe1, "shift"], [0xffe2, "right_shift"], [0xffe3, "control"], [0xffe4, "right_control"],
        [0xffe9, "alt"], [0xffea, "right_alt"], [0xffeb, "meta"], [0xffec, "right_meta"]]
        .filter(([symbol]) => { const code = keyCode(display, symbol); return bytes[code >> 3] & 1 << (code & 7); })
        .map(([, name]) => String(name));
    },
    verify: (point, keyboardFocus = false) => {
      const next = region(web);
      if (nativeBinding().getActiveWindow() !== active || !showing(web) || string(getName(web, null)) !== page.title ||
        Object.keys(rect).some((key) => rect[key as keyof NativePageRect] !== next[key as keyof NativePageRect]))
        return fail("The webpage moved, resized, or lost focus. Take a fresh snapshot.");
      if (keyboardFocus && !focused(web)) return fail("Keyboard focus is outside the webpage. Click inside the webpage before typing.");
      if (point && (!pointerWindow(display, active, point) || !contains(web, point))) return fail("The pointer target is covered or outside the webpage.");
    },
  };
};
