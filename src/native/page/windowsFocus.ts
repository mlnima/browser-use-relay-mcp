import koffi from "koffi";
import type { NativePage, NativePageRect } from "../../types/action.js";
import { createNativeError } from "../nativeError.js";

const ole = koffi.load("ole32.dll");
const automation = koffi.load("oleaut32.dll");
const initialize = ole.func("int32 __stdcall CoInitializeEx(void *reserved, uint32 flags)");
const parseGuid = ole.func("int32 __stdcall CLSIDFromString(str16 text, _Out_ void *guid)");
const create = ole.func("int32 __stdcall CoCreateInstance(void *classId, void *outer, uint32 context, void *interfaceId, _Out_ void **result)");
const freeString = automation.func("void __stdcall SysFreeString(void *value)");
koffi.struct("RelayFocusRect", { left: "int32", top: "int32", right: "int32", bottom: "int32" });
koffi.struct("RelayFocusPoint", { x: "int32", y: "int32" });
const pointerResult = koffi.proto("int32 __stdcall RelayFocusPointer(void *self, _Out_ void **result)");
const numberResult = koffi.proto("int32 __stdcall RelayFocusNumber(void *self, _Out_ int32 *result)");
const handleResult = koffi.proto("int32 __stdcall RelayFocusHandle(void *self, _Out_ uintptr *result)");
const rectResult = koffi.proto("int32 __stdcall RelayFocusBounds(void *self, _Out_ RelayFocusRect *result)");
const parentResult = koffi.proto("int32 __stdcall RelayFocusParent(void *self, void *element, _Out_ void **result)");
const releaseResult = koffi.proto("uint32 __stdcall RelayFocusRelease(void *self)");
const pointResult = koffi.proto("int32 __stdcall RelayFocusAtPoint(void *self, RelayFocusPoint point, _Out_ void **result)");
let client: unknown;
let walker: unknown;
const fail = (): never => { throw createNativeError("NATIVE_PAGE_UNAVAILABLE", "Windows accessibility cannot verify webpage keyboard focus."); };
const method = (element: unknown, index: number) => {
  const table = koffi.decode(element, "void *");
  return koffi.decode(table, index * koffi.sizeof("void *"), "void *");
};
const call = (element: unknown, index: number, type: ReturnType<typeof koffi.proto>, ...args: unknown[]) =>
  koffi.call(method(element, index), type, element, ...args);
const release = (element: unknown) => element && call(element, 2, releaseResult);
const pointer = (element: unknown, index: number) => {
  const value = [null];
  if (call(element, index, pointerResult, value) < 0 || !value[0]) return fail();
  return value[0];
};
const guid = (value: string) => {
  const result = Buffer.alloc(16);
  if (parseGuid(value, result) < 0) return fail();
  return result;
};
const prepare = () => {
  if (client && walker) return;
  const initialized = initialize(null, 0);
  if (initialized < 0 && initialized !== -2147417850) return fail();
  const result = [null];
  if (create(guid("{ff48dba4-60ef-4201-aa87-54103eef594e}"), null, 1,
    guid("{30cbe57d-d9d0-452a-ab13-7ac5ac4825ee}"), result) < 0 || !result[0]) return fail();
  client = result[0];
  try { walker = pointer(client, 16); } catch (error) { release(client); client = undefined; throw error; }
};

export const windowsPageFocused = (page: NativePage, window: number, renderer: number, rect: NativePageRect, point?: { x: number; y: number }) => {
  prepare();
  const found = [null];
  if (point && (call(client, 7, pointResult, point, found) < 0 || !found[0])) return fail();
  let element: unknown = point ? found[0] : pointer(client, 8);
  let document = false;
  try {
    for (let depth = 0; element && depth < 64; depth += 1) {
      const role = [0], handle = [0];
      if (call(element, 21, numberResult, role) < 0 || call(element, 36, handleResult, handle) < 0) return fail();
      if (role[0] === 50030) {
        const name = pointer(element, 23);
        let title: string;
        try { title = koffi.decode(name, "char16", -1) as string; } finally { freeString(name); }
        const bounds = { left: 0, top: 0, right: 0, bottom: 0 };
        if (call(element, 43, rectResult, bounds) < 0) return fail();
        document ||= title === page.title && bounds.left >= rect.x && bounds.top >= rect.y &&
          bounds.right <= rect.x + rect.width && bounds.bottom <= rect.y + rect.height &&
          bounds.right > bounds.left && bounds.bottom > bounds.top;
      }
      if (handle[0] === renderer || handle[0] === window) return document;
      const next = [null];
      if (call(walker, 3, parentResult, element, next) < 0) return fail();
      release(element); element = next[0];
    }
    return false;
  } finally { release(element); }
};
