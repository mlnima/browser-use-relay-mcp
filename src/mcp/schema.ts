import * as z from "zod/v4";
import { MAX_RELAY_IDENTIFIER_CHARACTERS, MAX_TIMER_MS } from "../protocol/limits.js";
import type { JsonValue } from "../types/json.js";
import { jsonValueFitsLimits } from "./jsonValueLimits.js";
import { getInputActionCatalog, isInputAction } from "../protocol/actionCatalog.js";
import type { InputEngine } from "../types/settings.js";

export const engineSchema = z.enum(["auto", "browser", "dom", "native"]);

export const locatorSchema = z.strictObject({
  selector: z.string().min(1).describe("Standard CSS selector only; use locator.text for visible text matching.").optional(),
  xpath: z.string().min(1).optional(),
  text: z.string().min(1).optional(),
  exactText: z.boolean().optional(),
  role: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  label: z.string().min(1).optional(),
  placeholder: z.string().min(1).optional(),
  nth: z.number().int().nonnegative().optional(),
}).refine((locator) => ["selector", "xpath", "text", "role", "name", "label", "placeholder"].some((key) => Object.prototype.hasOwnProperty.call(locator, key)), "A locator strategy is required.").optional();

export const targetSchema = z.strictObject({
  tabId: z.number().int().nonnegative().optional(),
  frameId: z.number().int().nonnegative().optional(),
  documentId: z.string().min(1).max(MAX_RELAY_IDENTIFIER_CHARACTERS).optional(),
  elementId: z.string().min(1).max(MAX_RELAY_IDENTIFIER_CHARACTERS).optional(),
  locator: locatorSchema,
  x: z.number().optional(),
  y: z.number().optional(),
}).refine((target) => (target.x === undefined) === (target.y === undefined), "Target x and y coordinates must be supplied together.").optional();

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() => z.union([
  z.string(), z.number().finite(), z.boolean(), z.null(),
  z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema),
]));

export const paramsSchema = z.record(z.string(), jsonValueSchema)
  .refine(jsonValueFitsLimits, "Parameters must be a bounded JSON object.")
  .optional();

export const actionFields = {
  action: z.string().min(1).max(MAX_RELAY_IDENTIFIER_CHARACTERS).describe("Action name returned by browser_capabilities."),
  engine: engineSchema.optional().describe("auto follows the ordered engines returned for the action by browser_capabilities."),
  target: targetSchema,
  params: paramsSchema,
  timeoutMs: z.number().int().positive().max(MAX_TIMER_MS).optional(),
  retries: z.number().int().nonnegative().max(10).optional(),
  retryDelayMs: z.number().int().nonnegative().max(MAX_TIMER_MS).optional(),
  expectedRevision: z.number().int().nonnegative().optional(),
};

export const actionInputSchema = z.strictObject(actionFields);

export const createActionSchema = (inputEngine: InputEngine) => {
  const catalog = getInputActionCatalog(inputEngine);
  const inputs = catalog.filter(isInputAction).map(({ name }) => name);
  const other = catalog.filter((definition) => !isInputAction(definition)).map(({ name }) => name);
  return inputEngine === "auto" ? actionInputSchema : z.union([
    z.strictObject({
      ...actionFields,
      action: z.enum(inputs),
      engine: z.literal(inputEngine).optional().describe(`Input actions use only ${inputEngine}.`),
      target: targetSchema.describe("Input coordinates are CSS viewport coordinates in the selected webpage/frame. Native input cannot target browser or OS UI."),
    }),
    z.strictObject({ ...actionFields, action: z.enum(other) }),
  ]);
};

export const createActionInputSchema = (inputEngine: InputEngine) => {
  const schema = createActionSchema(inputEngine);
  const standard = schema["~standard"];
  return { "~standard": {
    ...standard,
    jsonSchema: {
      input: (options: Parameters<typeof standard.jsonSchema.input>[0]) => ({ type: "object", ...standard.jsonSchema.input(options) }),
      output: (options: Parameters<typeof standard.jsonSchema.output>[0]) => ({ type: "object", ...standard.jsonSchema.output(options) }),
    },
  } };
};
