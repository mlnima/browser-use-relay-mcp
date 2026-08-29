import type { McpServer } from "@modelcontextprotocol/server";
import { getActionDefinition } from "../../protocol/actionCatalog.js";
import type { RelayClient } from "../../types/mcp.js";
import { createActionRequest } from "../createActionRequest.js";
import { actionResultContent } from "../result.js";
import { actionInputSchema } from "../schema.js";
import { snapshotResultContent } from "../snapshotResult.js";

export const registerQueryTool = (server: McpServer, client: RelayClient) => server.registerTool(
  "browser_query",
  {
    title: "Query browser",
    description: "Run a catalog-defined read query. Some browser observations may activate a tab or attach debugger instrumentation.",
    inputSchema: actionInputSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  async (input, context) => {
    const definition = getActionDefinition(input.action);
    if (!definition?.readOnly) throw new Error(`Action ${input.action} is not a registered read-only action.`);
    if (input.engine && input.engine !== "auto" && !definition.engines.some((engine) => engine === input.engine))
      throw new Error(`Action ${input.action} does not support the ${input.engine} engine.`);
    const result = await client.execute(createActionRequest(input), context.mcpReq.signal);
    return input.action === "snapshot" ? snapshotResultContent(result) : actionResultContent(result);
  },
);
