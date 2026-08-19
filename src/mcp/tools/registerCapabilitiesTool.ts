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

const runtimeCapabilities = async (client: RelayClient, signal: AbortSignal): Promise<JsonValue> => {
  try {
    const result = await client.execute(createActionRequest({ action: "getRuntimeCapabilities", engine: "browser" }), signal);
    return result.success
      ? { available: true, data: result.data ?? null }
      : { available: false, error: result.error?.message || "Runtime capability inspection failed." };
  } catch (error) {
    signal.throwIfAborted();
    return { available: false, error: error instanceof Error ? error.message : "Runtime capability inspection failed." };
  }
};

export const registerCapabilitiesTool = (server: McpServer, client: RelayClient) => server.registerTool(
  "browser_capabilities",
  {
    title: "Browser capabilities",
    description: "List the selected browser relay protocol, runtime availability, and every action with routing metadata.",
    inputSchema: z.strictObject({}),
    outputSchema: z.strictObject({ protocolVersion: z.string(), targetGuide: z.any(), categoryParameterGuides: z.any(), actionParameterOverrides: z.any(), actions: z.array(z.any()), runtime: z.any() }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  async (_input, context) => resultContent({
    protocolVersion: RELAY_PROTOCOL_VERSION,
    targetGuide,
    categoryParameterGuides,
    actionParameterOverrides,
    actions: actionCatalog,
    runtime: await runtimeCapabilities(client, context.mcpReq.signal),
  }),
);
