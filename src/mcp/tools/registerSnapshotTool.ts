import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { DEFAULT_SNAPSHOT_ELEMENTS, MAX_SNAPSHOT_ELEMENTS } from "../../protocol/limits.js";
import type { RelayClient } from "../../types/mcp.js";
import { createActionRequest } from "../createActionRequest.js";
import { snapshotResultContent } from "../snapshotResult.js";

export const registerSnapshotTool = (server: McpServer, client: RelayClient) => server.registerTool(
  "browser_snapshot",
  {
    title: "Observe browser",
    description: "Return bounded page state and a sparse, revisioned element catalog without changing the website DOM. Omitted visible/enabled mean true; omitted editable/readonly mean false. Use getBoundingBox when coordinates are needed.",
    inputSchema: z.strictObject({
      tabId: z.number().int().nonnegative().optional(),
      includeScreenshot: z.boolean().optional(),
      includeHidden: z.boolean().optional(),
      allFrames: z.boolean().optional(),
      maxElements: z.number().int().positive().max(MAX_SNAPSHOT_ELEMENTS).optional(),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  async (input, context) => snapshotResultContent(await client.execute(createActionRequest({
    action: "snapshot",
    target: { tabId: input.tabId },
    params: {
      includeScreenshot: input.includeScreenshot ?? false,
      includeHidden: input.includeHidden ?? false,
      allFrames: input.allFrames ?? false,
      maxElements: input.maxElements ?? DEFAULT_SNAPSHOT_ELEMENTS,
    },
  }), context.mcpReq.signal)),
);
