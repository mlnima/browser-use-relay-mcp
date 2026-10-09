import koffi from "koffi";
import type { NativePage, NativePageRect, NativePageSurface } from "../../types/action.js";
import { createNativeError } from "../nativeError.js";

const ax = koffi.load("/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices");
const cf = koffi.load("/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation");
const createSystem = ax.func("void *AXUIElementCreateSystemWide()");
const copyAttribute = ax.func("int AXUIElementCopyAttributeValue(void *element, void *attribute, _Out_ void **value)");
const valueGet = ax.func("bool AXValueGetValue(void *value, int type, _Out_ double *result)");
const elementAt = ax.func("int AXUIElementCopyElementAtPosition(void *element, float x, float y, _Out_ void **result)");
const keyState = ax.func("bool CGEventSourceKeyState(int state, uint16 key)");
const makeString = cf.func("void *CFStringCreateWithCString(void *allocator, str value, uint32 encoding)");
const stringGet = cf.func("bool CFStringGetCString(void *string, _Out_ char *result, long size, uint32 encoding)");
const release = cf.func("void CFRelease(void *value)");
const equal = cf.func("bool CFEqual(void *left, void *right)");
const attributes = new Map<string, unknown>();
const fail = (message: string): never => { throw createNativeError("NATIVE_PAGE_UNAVAILABLE", message); };
const attribute = (element: unknown, name: string) => {
  const key = attributes.get(name) || makeString(null, name, 0x08000100);
  attributes.set(name, key);
  const value = [null];
  if (copyAttribute(element, key, value) !== 0 || !value[0]) return fail(`macOS webpage ${name} is unavailable. Accessibility permission is required.`);
  return value[0];
};
const text = (element: unknown, name: string) => {
  const value = attribute(element, name);
  try {
    const bytes = Buffer.alloc(8192);
    if (!stringGet(value, bytes, bytes.length, 0x08000100)) return fail("macOS webpage text is unavailable.");
    return bytes.toString("utf8").split("\0")[0];
  } finally { release(value); }
};
const pair = (element: unknown, name: string, type: number) => {
  const value = attribute(element, name);
  try {
    const values = [0, 0];
    if (!valueGet(value, type, values)) return fail("macOS webpage geometry is unavailable.");
    return values;
  } finally { release(value); }
};
const region = (element: unknown): NativePageRect => {
  const [x, y] = pair(element, "AXPosition", 1);
  const [width, height] = pair(element, "AXSize", 2);
  return { x, y, width, height };
};
const focusedWebArea = (application: unknown) => {
  let element = attribute(application, "AXFocusedUIElement");
  try {
    for (let depth = 0; depth < 64; depth += 1) {
      if (text(element, "AXRole") === "AXWebArea") return element;
      const next = attribute(element, "AXParent");
      release(element);
      element = next;
    }
    return fail("Keyboard focus is outside the webpage.");
  } catch (error) { release(element); throw error; }
};

export const openMacosPage = (page: NativePage): NativePageSurface => {
  const system = createSystem();
  let application: unknown;
  let web: unknown;
  try {
    application = attribute(system, "AXFocusedApplication");
    web = focusedWebArea(application);
    if (!page.focused || text(web, "AXTitle") !== page.title) return fail("The requested webpage is not foreground.");
    const rect = region(web);
    return {
      id: String(koffi.address(web)), rect,
      close: () => { release(web); release(application); release(system); },
      keys: () => [[55, "meta"], [54, "right_meta"], [59, "control"], [62, "right_control"],
        [56, "shift"], [60, "right_shift"], [58, "alt"], [61, "right_alt"]]
        .filter(([key]) => keyState(0, key)).map(([, name]) => String(name)),
      verify: (point) => {
        const active = attribute(system, "AXFocusedApplication");
        let current: unknown;
        try {
          if (!equal(active, application)) return fail("The webpage lost focus.");
          current = focusedWebArea(active);
          const next = region(current);
          if (!equal(current, web) || text(current, "AXTitle") !== page.title ||
            Object.keys(rect).some((key) => rect[key as keyof NativePageRect] !== next[key as keyof NativePageRect]))
            return fail("The webpage moved, resized, or lost focus. Take a fresh snapshot.");
          if (point) {
            const hit = [null];
            if (elementAt(system, point.x, point.y, hit) !== 0 || !hit[0]) return fail("The pointer target is unavailable.");
            let node: unknown = hit[0];
            let found = false;
            try {
              for (let depth = 0; depth < 64; depth += 1) {
                if (equal(node, web)) { found = true; break; }
                const next = attribute(node, "AXParent");
                release(node); node = next;
              }
              if (!found) return fail("The pointer target is outside or covering the webpage.");
            } finally { release(node); }
          }
        } finally { current && release(current); release(active); }
      },
    };
  } catch (error) { web && release(web); application && release(application); release(system); throw error; }
};
