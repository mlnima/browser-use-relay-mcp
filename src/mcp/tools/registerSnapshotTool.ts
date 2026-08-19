import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { DEFAULT_SNAPSHOT_ELEMENTS, MAX_SNAPSHOT_ELEMENTS } from "../../protocol/limits.js";
import type { RelayClient } from "../../types/mcp.js";
import { createActionRequest } from "../createActionRequest.js";
import { actionResultContent } from "../result.js";

export const registerSnapshotTool = (server: McpServer, client: RelayClient) => server.registerTool(
  "browser_snapshot",
  {
    title: "Observe browser",
    description: "Return page state and a revisioned, in-memory element catalog without marking or changing the website DOM.",
    inputSchema: z.strictObject({
      tabId: z.number().int().nonnegative().optional(),
      includeScreenshot: z.boolean().optional(),
      includeHidden: z.boolean().optional(),
      allFrames: z.boolean().optional(),
      maxElements: z.number().int().positive().max(MAX_SNAPSHOT_ELEMENTS).optional(),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  async (input, context) => actionResultContent(await client.execute(createActionRequest({
    action: "snapshot",
    target: { tabId: input.tabId },
    params: {
      includeScreenshot: input.includeScreenshot ?? false,
      includeHidden: input.includeHidden ?? false,
      allFrames: input.allFrames ?? true,
      maxElements: input.maxElements ?? DEFAULT_SNAPSHOT_ELEMENTS,
    },
  }), context.mcpReq.signal)),
);
