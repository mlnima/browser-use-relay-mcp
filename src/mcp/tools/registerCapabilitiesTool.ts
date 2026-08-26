import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { actionCatalog } from "../../protocol/actionCatalog.js";
import { RELAY_PROTOCOL_VERSION } from "../../protocol/version.js";
import { actionParameterOverrides } from "../../protocol/parameterOverrides.js";
import { categoryParameterGuides, targetGuide } from "../../protocol/parameterGuides.js";
import type { JsonValue } from "../../types/json.js";
import type { RelayClient } from "../../types/mcp.js";
import { createActionRequest } from "../createActionRequest.js";
import { resultContent } from "../result.js";

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

const capabilityCatalog = (input: { actions?: string[]; categories?: string[]; detail?: "summary" | "full" }) => {
  const actionNames = new Set(input.actions || []);
  const categories = new Set(input.categories || []);
  const filtered = actionNames.size || categories.size
    ? actionCatalog.filter((action) => actionNames.has(action.name) || categories.has(action.category))
    : actionCatalog;
  const detailed = input.detail === "full" || actionNames.size > 0 || categories.size > 0;
  const selectedCategories = new Set(filtered.map((action) => action.category));
  const selectedActions = new Set(filtered.map((action) => action.name));
  return {
    categoryParameterGuides: detailed ? selectEntries(categoryParameterGuides, selectedCategories) : {},
    actionParameterOverrides: detailed ? selectEntries(actionParameterOverrides, selectedActions) : {},
    actions: detailed ? filtered : filtered.map(({ name, category }) => ({ name, category })),
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
    outputSchema: z.strictObject({ protocolVersion: z.string(), targetGuide: z.any(), categoryParameterGuides: z.any(), actionParameterOverrides: z.any(), actions: z.array(z.any()), runtime: z.any() }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  async (input, context) => resultContent({
    protocolVersion: RELAY_PROTOCOL_VERSION,
    targetGuide,
    ...capabilityCatalog(input),
    runtime: await runtimeCapabilities(client, context.mcpReq.signal, input.detail === "full"),
  }),
);
