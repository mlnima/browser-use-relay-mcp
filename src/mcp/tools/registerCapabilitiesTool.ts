import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { getInputActionCatalog, isInputAction } from "../../protocol/actionCatalog.js";
import type { InputEngine } from "../../types/settings.js";
import { RELAY_PROTOCOL_VERSION } from "../../protocol/version.js";
import { actionParameterOverrides } from "../../protocol/parameterOverrides.js";
import { categoryParameterGuides, targetGuide } from "../../protocol/parameterGuides.js";
import type { JsonValue } from "../../types/json.js";
import type { RelayClient } from "../../types/mcp.js";
import { createActionRequest } from "../createActionRequest.js";
import { structuredResultContent } from "../result.js";

const compactRuntimeData = (data: JsonValue | undefined): JsonValue => {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data ?? null;
  const record = data as { readonly [key: string]: JsonValue };
  return {
    platform: record.platform ?? null,
    extension: record.extension ?? null,
    relay: record.relay ?? null,
    browserApis: record.browserApis ?? null,
    pageContentAvailability: record.pageContentAvailability ?? null,
  };
};

const runtimeCapabilities = async (client: RelayClient, signal: AbortSignal, full: boolean): Promise<JsonValue> => {
  try {
    const result = await client.execute(createActionRequest({ action: "getRuntimeCapabilities", engine: "browser" }), signal);
    return result.success
      ? { available: true, data: full ? result.data ?? null : compactRuntimeData(result.data) }
      : { available: false, error: result.error?.message || "Runtime capability inspection failed." };
  } catch (error) {
    signal.throwIfAborted();
    return { available: false, error: error instanceof Error ? error.message : "Runtime capability inspection failed." };
  }
};

const selectEntries = (record: Record<string, string>, keys: Set<string>) => Object.fromEntries(
  Object.entries(record).filter(([key]) => keys.has(key)),
);

const capabilityCatalog = (input: { actions?: string[]; categories?: string[]; detail?: "summary" | "full" }, inputEngine: InputEngine) => {
  const actionNames = new Set(input.actions || []);
  const categories = new Set(input.categories || []);
  const catalog = getInputActionCatalog(inputEngine);
  const filtered = actionNames.size || categories.size
    ? catalog.filter((action) => actionNames.has(action.name) || categories.has(action.category))
    : catalog;
  const detailed = input.detail === "full" || actionNames.size > 0 || categories.size > 0;
  const selectedCategories = new Set(filtered.map((action) => action.category));
  const selectedActions = new Set(filtered.map((action) => action.name));
  const guides = selectEntries(categoryParameterGuides, selectedCategories);
  const overrides = selectEntries(actionParameterOverrides, selectedActions);
  if (inputEngine !== "auto") {
    const coordinates = "frame viewport coordinates or a revisioned element target";
    const inputGuide = `Only the ${inputEngine} engine is available for input. Use ${coordinates}. Keyboard actions without a target use current focus.`;
    for (const definition of filtered.filter(isInputAction)) {
      guides[definition.category] = inputGuide;
      if (overrides[definition.name] && definition.engines.length > 1) overrides[definition.name] = inputGuide;
    }
    overrides.fillField && (overrides.fillField += " params.value is required.");
    overrides.findAndFill && (overrides.findAndFill += " params.value is required.");
    overrides.chooseOption && (overrides.chooseOption += " params.value selects an option by typing and Enter.");
    overrides.selectRange && (overrides.selectRange += " params.start/end are integers from 0 to 1000.");
    overrides.dragElement && (overrides.dragElement += " Supply params.destination x/y or toX/toY.");
    overrides.scrollElement && (overrides.scrollElement += " Supply nonzero params.x/y deltas.");
    guides.pointer && (guides.pointer += ` params.button accepts ${inputEngine === "native" ? "left|middle|right" : "left|middle|right|back|forward"}; modifiers, durationMs, clickIntervalMs, destination, toX/toY apply when supported.`);
    guides.keyboard && (guides.keyboard += " Use params.key, keys, shortcut, text, modifiers, count, intervalMs, or delayMs as required by the action.");
    guides.text && (guides.text += " setValue requires params.value; insert/append/replace require params.text.");
    guides.scroll && (guides.scroll += " Use params.amount for directional scrolling or x/y and deltaX/deltaY for wheel deltas.");
  }
  return {
    categoryParameterGuides: detailed ? guides : {},
    actionParameterOverrides: detailed ? overrides : {},
    actions: detailed ? filtered : filtered.map((definition) => ({ name: definition.name, category: definition.category,
      ...(inputEngine !== "auto" && isInputAction(definition) ? { engines: definition.engines } : {}),
    })),
  };
};

export const registerCapabilitiesTool = (server: McpServer, client: RelayClient) => server.registerTool(
  "browser_capabilities",
  {
    title: "Browser capabilities",
    description: "List browser relay actions and runtime availability. The default returns action names, categories, and compact runtime state. Pass only the intended action names or categories for focused metadata; request full detail only when the entire reference is required.",
    inputSchema: z.strictObject({
      actions: z.array(z.string().min(1).max(256)).max(100).optional(),
      categories: z.array(z.string().min(1).max(256)).max(100).optional(),
      detail: z.enum(["summary", "full"]).optional(),
    }),
    outputSchema: z.strictObject({ protocolVersion: z.string(), inputEngine: z.enum(["auto", "browser", "native"]), targetGuide: z.any(), categoryParameterGuides: z.any(), actionParameterOverrides: z.any(), actions: z.array(z.any()), runtime: z.any() }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  async (input, context) => {
    const runtime = await runtimeCapabilities(client, context.mcpReq.signal, input.detail === "full");
    const inputEngine = client.inputEngine();
    return structuredResultContent({
      protocolVersion: RELAY_PROTOCOL_VERSION,
      inputEngine,
      targetGuide: inputEngine === "auto" ? targetGuide : {
        ...targetGuide,
        x: "Selected-frame CSS viewport x coordinate. Native input is confined to the visible webpage.",
        y: "Selected-frame CSS viewport y coordinate. Native input is confined to the visible webpage.",
        nativeFallback: `Input uses only the ${inputEngine} engine, without engine fallback.`,
      },
      ...capabilityCatalog(input, inputEngine),
      runtime,
    });
  },
);
