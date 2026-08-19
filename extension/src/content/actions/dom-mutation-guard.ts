import type { JsonValue } from "../../../../src/types/json.js";
import { collectElements } from "../catalog/element-tree.js";

const identifierNames = new Set(["id", "class", "classname", "classlist"]);

const localName = (name: string) => name.toLowerCase().split(":").at(-1) || "";

export const assertNonIdentifierName = (name: string): void => {
  if (identifierNames.has(localName(name))) throw new Error(`Mutation of "${name}" is forbidden.`);
};

export const objectValue = (value: JsonValue | undefined, label: string): Record<string, JsonValue> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, JsonValue>;
};

export const assertIdentifierFreeMarkup = (markup: string): void => {
  const template = document.createElement("template");
  template.innerHTML = markup;
  if (collectElements(template.content).some((element) => element.matches("[id],[class]"))) throw new Error("Inserted markup cannot contain id or class attributes.");
};

export const assertReplaceableChildren = (element: Element): void => {
  if (collectElements(element).some((child) => child.matches("[id],[class]"))) {
    throw new Error("Replacing these children would remove id or class attributes.");
  }
};

export const assertIdentifierFreeTree = (element: Element): void => {
  if (element.matches("[id],[class]") || collectElements(element).some((child) => child.matches("[id],[class]"))) {
    throw new Error("Cloned content with id or class attributes cannot be inserted.");
  }
};

export const assertSafeMethod = (name: string, args: JsonValue[]): void => {
  if (identifierNames.has(localName(name))) throw new Error(`Method "${name}" is forbidden.`);
  const normalized = name.toLowerCase();
  const attributeIndex = normalized.endsWith("attributens") ? 1 : 0;
  if (/^(set|remove|toggle)attribute(ns)?$/.test(normalized)) {
    assertNonIdentifierName(String(args[attributeIndex] ?? ""));
  }
  if (normalized === "insertadjacenthtml") assertIdentifierFreeMarkup(String(args[1] ?? ""));
};

export const assertSafeStructuralMethod = (element: Element, name: string, args: JsonValue[]): void => {
  const normalized = name.toLowerCase();
  assertSafeMethod(name, args);
  if (["setattributenode", "setattributenodens", "removeattributenode"].includes(normalized)) {
    throw new Error(`Method "${name}" cannot receive attribute nodes.`);
  }
  if (["sethtml", "sethtmlunsafe"].includes(normalized)) {
    assertReplaceableChildren(element);
    assertIdentifierFreeMarkup(String(args[0] ?? ""));
  }
  if (normalized === "replacechildren") assertReplaceableChildren(element);
  if (["remove", "replacewith", "removechild", "replacechild"].includes(normalized)) {
    assertIdentifierFreeTree(element);
  }
};
