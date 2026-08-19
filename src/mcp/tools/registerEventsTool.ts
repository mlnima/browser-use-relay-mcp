import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { MAX_RELAY_EVENTS } from "../../protocol/limits.js";
import type { RelayClient } from "../../types/mcp.js";
import { resultContent } from "../result.js";

export const registerEventsTool = (server: McpServer, client: RelayClient) => server.registerTool(
  "browser_events",
  {
    title: "Read browser events",
    description: "Read recent relay, navigation, DOM revision, request, download, error, and lifecycle events.",
    inputSchema: z.strictObject({
      limit: z.number().int().positive().max(MAX_RELAY_EVENTS).optional(),
      afterSequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  async ({ limit, afterSequence }, context) => {
    await client.connect(context.mcpReq.signal);
    return resultContent(client.events(limit, afterSequence));
  },
);
