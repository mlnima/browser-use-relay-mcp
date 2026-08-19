import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { MAX_FILE_PATH_CHARACTERS } from "../../protocol/limits.js";
import type { RelayClient } from "../../types/mcp.js";
import { downloadRemoteFile } from "../files/downloadRemoteFile.js";
import { resultContent } from "../result.js";

export const registerDownloadTool = (server: McpServer, client: RelayClient) => server.registerTool(
  "browser_download_file",
  {
    title: "Copy browser-device file",
    description: "Copy a completed download or other explicitly supplied browser-device file to the MCP client machine with per-chunk integrity checks.",
    inputSchema: z.strictObject({ remotePath: z.string().min(1).max(MAX_FILE_PATH_CHARACTERS), destinationPath: z.string().min(1).max(MAX_FILE_PATH_CHARACTERS), overwrite: z.boolean().optional() }),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  },
  async ({ remotePath, destinationPath, overwrite }, context) => resultContent(await downloadRemoteFile(
    client,
    remotePath,
    destinationPath,
    overwrite ?? false,
    context.mcpReq.signal,
  )),
);
