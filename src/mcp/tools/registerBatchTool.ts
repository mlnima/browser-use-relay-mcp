import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { getActionDefinition } from "../../protocol/actionCatalog.js";
import { MAX_BATCH_ACTIONS, MAX_BATCH_RESULT_BYTES, MAX_BATCH_RESULT_ENVELOPE_BYTES, MAX_RELAY_ERROR_CHARACTERS } from "../../protocol/limits.js";
import type { RelayClient } from "../../types/mcp.js";
import { createActionRequest } from "../createActionRequest.js";
import { resultContent } from "../result.js";
import { actionInputSchema } from "../schema.js";

export const registerBatchTool = (server: McpServer, client: RelayClient) => server.registerTool(
  "browser_batch",
  {
    title: "Run browser action sequence",
    description: "Execute an ordered sequence against one selected browser, stopping on failure by default.",
    inputSchema: z.strictObject({ actions: z.array(actionInputSchema).min(1).max(MAX_BATCH_ACTIONS), stopOnError: z.boolean().optional() }),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  },
  async (input, context) => {
    const unknown = input.actions.find((action) => !getActionDefinition(action.action));
    if (unknown) throw new Error(`Unknown browser action: ${unknown.action}`);
    const unsupported = input.actions.find((action) => action.engine && action.engine !== "auto" &&
      !getActionDefinition(action.action)?.engines.some((engine) => engine === action.engine));
    if (unsupported) throw new Error(`Action ${unsupported.action} does not support the ${unsupported.engine} engine.`);
    const results = [];
    let encodedBytes = 2;
    for (const [index, action] of input.actions.entries()) {
      context.mcpReq.signal.throwIfAborted();
      try {
        const result = await client.execute(createActionRequest(action), context.mcpReq.signal);
        const resultBytes = Buffer.byteLength(JSON.stringify(result), "utf8");
        const requiredBytes = resultBytes + Number(results.length > 0);
        if (encodedBytes + requiredBytes > MAX_BATCH_RESULT_BYTES - MAX_BATCH_RESULT_ENVELOPE_BYTES) return {
          ...resultContent({
            results, stoppedAt: index,
            reason: {
              code: "BATCH_RESULT_BUDGET_EXCEEDED", message: "Batch result byte budget exceeded.",
              byteLimit: MAX_BATCH_RESULT_BYTES, envelopeReserveBytes: MAX_BATCH_RESULT_ENVELOPE_BYTES,
              encodedBytes, rejectedResultBytes: resultBytes,
            },
          }),
          isError: true,
        };
        results.push(result);
        encodedBytes += requiredBytes;
        if (!result.success && input.stopOnError !== false) break;
      } catch (error) {
        context.mcpReq.signal.throwIfAborted();
        return {
          ...resultContent({
            results, stoppedAt: index,
            error: { code: "RELAY_EXECUTION_FAILED", message: (error instanceof Error ? error.message : "Relay execution failed.").slice(0, MAX_RELAY_ERROR_CHARACTERS) },
          }),
          isError: true,
        };
      }
    }
    return { ...resultContent({ results, encodedBytes, byteLimit: MAX_BATCH_RESULT_BYTES }), isError: results.some((result) => !result.success) };
  },
);
