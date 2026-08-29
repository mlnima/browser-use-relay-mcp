import type { McpServer } from "@modelcontextprotocol/server";
import { getActionDefinition } from "../../protocol/actionCatalog.js";
import type { RelayClient } from "../../types/mcp.js";
import { createActionRequest } from "../createActionRequest.js";
import { actionResultContent } from "../result.js";
import { actionInputSchema } from "../schema.js";
import { imageActionResultContent, snapshotResultContent } from "../snapshotResult.js";

const imageActions = new Set(["captureVisibleTab", "captureViewport", "captureElement"]);

export const registerActionTool = (server: McpServer, client: RelayClient) => server.registerTool(
  "browser_action",
  {
    title: "Act in browser",
    description: "Execute one revision-aware human browser action through automatic DOM, browser-input, or native routing.",
    inputSchema: actionInputSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  },
  async (input, context) => {
    const definition = getActionDefinition(input.action);
    if (!definition) throw new Error(`Unknown browser action: ${input.action}`);
    if (input.engine && input.engine !== "auto" && !definition.engines.some((engine) => engine === input.engine))
      throw new Error(`Action ${input.action} does not support the ${input.engine} engine.`);
    const result = await client.execute(createActionRequest(input), context.mcpReq.signal);
    return input.action === "snapshot" ? snapshotResultContent(result)
      : imageActions.has(input.action) ? imageActionResultContent(result) : actionResultContent(result);
  },
);
