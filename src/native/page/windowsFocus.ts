import koffi from "koffi";
import { createNativeError } from "../nativeError.js";

const ole = koffi.load("ole32.dll");
const accessibility = koffi.load("oleacc.dll");
const automation = koffi.load("oleaut32.dll");
const initialize = ole.func("int32 __stdcall CoInitializeEx(void *reserved, uint32 flags)");
const parseGuid = ole.func("int32 __stdcall CLSIDFromString(str16 text, _Out_ void *guid)");
const fromWindow = accessibility.func("int32 __stdcall AccessibleObjectFromWindow(uintptr window, uint32 id, void *iid, _Out_ void **result)");
const windowFrom = accessibility.func("int32 __stdcall WindowFromAccessibleObject(void *element, _Out_ uintptr *window)");
const clear = automation.func("int32 __stdcall VariantClear(void *value)");
const focusResult = koffi.proto("int32 __stdcall RelayPageFocus(void *self, _Out_ void *result)");
const parentResult = koffi.proto("int32 __stdcall RelayPageParent(void *self, _Out_ void **result)");
const queryResult = koffi.proto("int32 __stdcall RelayPageQuery(void *self, void *iid, _Out_ void **result)");
const releaseResult = koffi.proto("uint32 __stdcall RelayPageRelease(void *self)");
const interfaceId = Buffer.alloc(16);
let initialized = false;
const fail = (): never => { throw createNativeError("NATIVE_PAGE_UNAVAILABLE", "Windows accessibility cannot verify webpage keyboard focus."); };
const call = (element: unknown, index: number, type: ReturnType<typeof koffi.proto>, ...args: unknown[]) => {
  const table = koffi.decode(element, "void *");
  return koffi.call(koffi.decode(table, index * koffi.sizeof("void *"), "void *"), type, element, ...args);
};

const accessible = (element: unknown) => {
  const result = [null];
  return call(element, 0, queryResult, interfaceId, result) === 0 ? result[0] : undefined;
};
const belongsTo = (element: unknown, renderer: number) => {
  let current = accessible(element);
  try {
    for (let depth = 0; current && depth < 96; depth += 1) {
      const window = [0];
      if (windowFrom(current, window) === 0 && window[0] === renderer) return true;
      const parent = [null];
      const result = call(current, 7, parentResult, parent);
      call(current, 2, releaseResult); current = undefined;
      if (result !== 0 || !parent[0]) return false;
      try { current = accessible(parent[0]); } finally { call(parent[0], 2, releaseResult); }
    }
    return false;
  } finally { current && call(current, 2, releaseResult); }
};

export const windowsPageFocused = (window: number, renderer: number) => {
  if (!initialized) {
    const result = initialize(null, 0);
    if (result < 0 && result !== -2147417850 || parseGuid("{618736e0-3c3d-11cf-810c-00aa00389b71}", interfaceId) < 0) return fail();
    initialized = true;
  }
  const document = [null];
  if (fromWindow(renderer, 0xfffffffc, interfaceId, document) < 0 || !document[0]) return fail();
  call(document[0], 2, releaseResult);
  const element = [null];
  if (fromWindow(window, 0xfffffffc, interfaceId, element) < 0 || !element[0]) return fail();
  const value = Buffer.alloc(process.arch === "ia32" ? 16 : 24);
  try {
    return call(element[0], 18, focusResult, value) === 0 && value.readUInt16LE(0) === 9 &&
      belongsTo(koffi.decode(value, 8, "void *"), renderer);
  }
  finally { clear(value); call(element[0], 2, releaseResult); }
};
