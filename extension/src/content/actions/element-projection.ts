import type { ElementProjection } from "../../../../src/types/action.js";
import { elementDescriptorFields } from "../../../../src/protocol/elementProjection.js";

const readNames = (value: unknown, label: string): string[] | undefined => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((name) => typeof name !== "string" || !name.length)) {
    throw new Error(`${label} must be an array of non-empty strings.`);
  }
  return value;
};

export const readElementProjection = (fields?: unknown, attributes?: unknown): ElementProjection => {
  const names = readNames(fields, "fields");
  if (names?.some((name) => !elementDescriptorFields.includes(name))) {
    throw new Error(`fields must contain only supported descriptor fields: ${elementDescriptorFields.join(", ")}.`);
  }
  return { fields: names, attributes: readNames(attributes, "attributes") };
};
