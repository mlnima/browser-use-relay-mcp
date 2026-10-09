import koffi from "koffi";
import { createNativeError } from "../nativeError.js";

const ole = koffi.load("ole32.dll");
const accessibility = koffi.load("oleacc.dll");
const automation = koffi.load("oleaut32.dll");
const initialize = ole.func("int32 __stdcall CoInitializeEx(void *reserved, uint32 flags)");
const parseGuid = ole.func("int32 __stdcall CLSIDFromString(str16 text, _Out_ void *guid)");
const fromWindow = accessibility.func("int32 __stdcall AccessibleObjectFromWindow(uintptr window, uint32 id, void *iid, _Out_ void **result)");
const clear = automation.func("int32 __stdcall VariantClear(void *value)");
const focusResult = koffi.proto("int32 __stdcall RelayPageFocus(void *self, _Out_ void *result)");
const releaseResult = koffi.proto("uint32 __stdcall RelayPageRelease(void *self)");
const interfaceId = Buffer.alloc(16);
let initialized = false;
const fail = (): never => { throw createNativeError("NATIVE_PAGE_UNAVAILABLE", "Windows accessibility cannot verify webpage keyboard focus."); };
const call = (element: unknown, index: number, type: ReturnType<typeof koffi.proto>, ...args: unknown[]) => {
  const table = koffi.decode(element, "void *");
  return koffi.call(koffi.decode(table, index * koffi.sizeof("void *"), "void *"), type, element, ...args);
};

export const windowsPageFocused = (renderer: number) => {
  if (!initialized) {
    const result = initialize(null, 0);
    if (result < 0 && result !== -2147417850 || parseGuid("{618736e0-3c3d-11cf-810c-00aa00389b71}", interfaceId) < 0) return fail();
    initialized = true;
  }
  const element = [null];
  if (fromWindow(renderer, 0xfffffffc, interfaceId, element) < 0 || !element[0]) return fail();
  const value = Buffer.alloc(process.arch === "ia32" ? 16 : 24);
  try { return call(element[0], 18, focusResult, value) === 0 && [3, 9].includes(value.readUInt16LE(0)); }
  finally { clear(value); call(element[0], 2, releaseResult); }
};
