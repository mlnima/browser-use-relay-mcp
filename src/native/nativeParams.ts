import type { ActionRequest } from "../types/action.js";
import type { JsonValue } from "../types/json.js";
import { createNativeError } from "./nativeError.js";

export const stringParam = (request: ActionRequest, name: string) => {
  const value = request.params?.[name];
  return typeof value === "string" ? value : undefined;
};

export const requiredStringParam = (request: ActionRequest, name: string) => {
  const value = stringParam(request, name);
  if (value !== undefined) return value;
  throw createNativeError("INVALID_NATIVE_PARAMETERS", `Parameter "${name}" must be a string.`);
};

export const textParam = (request: ActionRequest, name: string) => {
  const value = request.params?.[name];
  if (value === undefined || value === null) return "";
  if (["string", "number", "boolean"].includes(typeof value)) return String(value);
  throw createNativeError("INVALID_NATIVE_PARAMETERS", `Parameter "${name}" must be text-compatible.`);
};

export const numberParam = (request: ActionRequest, name: string) => {
  const value = request.params?.[name];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};

export const integerParam = (request: ActionRequest, name: string, fallback?: number) => {
  const value = numberParam(request, name) ?? fallback;
  if (value !== undefined && Number.isSafeInteger(value)) return value;
  throw createNativeError("INVALID_NATIVE_PARAMETERS", `Parameter "${name}" must be an integer.`);
};

export const booleanParam = (request: ActionRequest, name: string) => {
  const value = request.params?.[name];
  return typeof value === "boolean" ? value : undefined;
};

export const stringArrayParam = (request: ActionRequest, name: string) => {
  const value = request.params?.[name];
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value as string[]
    : undefined;
};

export const objectParam = (request: ActionRequest, name: string) => {
  const value = request.params?.[name];
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, JsonValue>
    : undefined;
};

const coordinateParam = (prefix: string, axis: "X" | "Y") => prefix ? `${prefix}${axis}` : axis.toLowerCase();

export const assertNoNativeWebTarget = (request: ActionRequest) => {
  const target = request.target;
  if (target && (target.tabId !== undefined || target.frameId !== undefined || target.documentId !== undefined ||
    target.elementId !== undefined || target.locator !== undefined))
    throw createNativeError("NATIVE_COORDINATES_REQUIRED", "Native targets support only complete screen coordinates.");
};

export const optionalRequestPoint = (request: ActionRequest, prefix = "") => {
  const xName = coordinateParam(prefix, "X");
  const yName = coordinateParam(prefix, "Y");
  const rawX = request.params?.[xName];
  const rawY = request.params?.[yName];
  const supplied = rawX !== undefined || rawY !== undefined;
  const targetSupplied = !prefix && (request.target?.x !== undefined || request.target?.y !== undefined);
  if (supplied && targetSupplied)
    throw createNativeError("NATIVE_COORDINATE_CONFLICT", "Screen coordinates cannot be supplied in both target and params.");
  if (!supplied && !targetSupplied) return undefined;
  const x = supplied ? rawX : request.target?.x;
  const y = supplied ? rawY : request.target?.y;
  if (typeof x === "number" && Number.isFinite(x) && typeof y === "number" && Number.isFinite(y)) return { x, y };
  throw createNativeError("NATIVE_COORDINATES_REQUIRED", `Screen coordinates ${prefix}X and ${prefix}Y must be provided together.`);
};
export const requestPoint = (request: ActionRequest, prefix = "") => optionalRequestPoint(request, prefix) || (() => {
  throw createNativeError("NATIVE_COORDINATES_REQUIRED", `Screen coordinates ${prefix}X and ${prefix}Y are required.`);
})();
