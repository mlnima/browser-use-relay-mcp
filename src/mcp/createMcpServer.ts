import { McpServer } from "@modelcontextprotocol/server";
import { PACKAGE_NAME } from "../protocol/version.js";
import type { RelayClient } from "../types/mcp.js";
import { registerActionTool } from "./tools/registerActionTool.js";
import { registerBatchTool } from "./tools/registerBatchTool.js";
import { registerCapabilitiesTool } from "./tools/registerCapabilitiesTool.js";
import { registerEventsTool } from "./tools/registerEventsTool.js";
import { registerDownloadTool } from "./tools/registerDownloadTool.js";
import { registerQueryTool } from "./tools/registerQueryTool.js";
import { registerSnapshotTool } from "./tools/registerSnapshotTool.js";
import { registerUploadTool } from "./tools/registerUploadTool.js";

const instructions = `Control exactly one configured Chromium browser through its local or LAN relay. Call browser_capabilities only for unfamiliar actions and browser_snapshot before targeting page elements. Prefer focused top-frame snapshots and element IDs from the latest revision; request all frames or explicit bounding boxes only when needed. Snapshot descriptors are sparse: absent visible/enabled mean true, while absent editable/readonly mean false. Use browser_query for reads, browser_action for one action, and browser_batch for ordered workflows. Automatic routing prefers real browser input and revalidates targets. The catalog never adds IDs or classes to websites.`;

export const createMcpServer = (client: RelayClient) => {
  const server = new McpServer({ name: PACKAGE_NAME, version: "1.0.0" }, { instructions });
  registerCapabilitiesTool(server, client);
  registerSnapshotTool(server, client);
  registerQueryTool(server, client);
  registerActionTool(server, client);
  registerBatchTool(server, client);
  registerEventsTool(server, client);
  registerUploadTool(server, client);
  registerDownloadTool(server, client);
  return server;
};
