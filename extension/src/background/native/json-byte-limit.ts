const stringBytes = (value: string, limit: number) => {
  let bytes = 2;
  for (let index = 0; index < value.length && bytes <= limit; index += 1) {
    const code = value.charCodeAt(index);
    if (code === 34 || code === 92 || [8, 9, 10, 12, 13].includes(code)) bytes += 2;
    else if (code <= 31) bytes += 6;
    else if (code <= 127) bytes += 1;
    else if (code <= 2_047) bytes += 2;
    else if (code >= 0xD800 && code <= 0xDBFF && value.charCodeAt(index + 1) >= 0xDC00 && value.charCodeAt(index + 1) <= 0xDFFF) {
      bytes += 4;
      index += 1;
    } else if (code >= 0xD800 && code <= 0xDFFF) bytes += 6;
    else bytes += 3;
  }
  return bytes;
};

const binaryBytes = (value: Uint8Array, limit: number) => {
  let bytes = 2;
  for (let index = 0; index < value.length && bytes <= limit; index += 1) {
    bytes += Number(index > 0) + String(value[index]).length;
  }
  return bytes;
};

const collectionBytes = (values: Iterable<unknown>, limit: number, stack: WeakSet<object>) => {
  let bytes = 2;
  let count = 0;
  for (const value of values) {
    bytes += Number(count > 0) + measure(value ?? null, limit - bytes, stack);
    count += 1;
    if (bytes > limit) break;
  }
  return bytes;
};

const measure = (value: unknown, limit: number, stack: WeakSet<object>): number => {
  if (value === null) return 4;
  if (typeof value === "string") return stringBytes(value, limit);
  if (typeof value === "boolean") return value ? 4 : 5;
  if (typeof value === "number") return Number.isFinite(value) ? String(value).length : 4;
  if (typeof value === "bigint") return stringBytes(value.toString(), limit);
  if (typeof value !== "object") return limit + 1;
  if (value instanceof ArrayBuffer) return binaryBytes(new Uint8Array(value), limit);
  if (ArrayBuffer.isView(value)) return binaryBytes(new Uint8Array(value.buffer, value.byteOffset, value.byteLength), limit);
  if (stack.has(value)) return limit + 1;
  stack.add(value);
  const toJSON = (value as { toJSON?: () => unknown }).toJSON;
  if (typeof toJSON === "function") {
    const output = toJSON.call(value);
    const bytes = output === value ? limit + 1 : measure(output, limit, stack);
    stack.delete(value);
    return bytes;
  }
  let bytes = 2;
  if (Array.isArray(value)) {
    bytes = collectionBytes(value, limit, stack);
  } else if (value instanceof Set) {
    bytes = collectionBytes(value, limit, stack);
  } else if (value instanceof Map) {
    let count = 0;
    for (const [key, child] of value) {
      if (["undefined", "function", "symbol"].includes(typeof child)) continue;
      bytes += Number(count > 0) + stringBytes(String(key), limit - bytes) + 1 + measure(child, limit - bytes, stack);
      count += 1;
      if (bytes > limit) break;
    }
  } else if (value instanceof Error) {
    bytes = measure({ name: value.name, message: value.message, stack: value.stack }, limit, stack);
  } else {
    let count = 0;
    for (const key in value) {
      if (!Object.hasOwn(value, key)) continue;
      const child = (value as Record<string, unknown>)[key];
      if (["undefined", "function", "symbol"].includes(typeof child)) continue;
      bytes += Number(count > 0) + stringBytes(key, limit - bytes) + 1 + measure(child, limit - bytes, stack);
      count += 1;
      if (bytes > limit) break;
    }
  }
  stack.delete(value);
  return bytes;
};

export const jsonByteLengthWithin = (value: unknown, limit: number) => {
  const bytes = measure(value, limit, new WeakSet());
  return bytes <= limit ? bytes : undefined;
};
export const jsonFitsByteLimit = (value: unknown, limit: number) => jsonByteLengthWithin(value, limit) !== undefined;
