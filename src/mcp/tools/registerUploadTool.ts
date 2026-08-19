import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { MAX_FILE_PATH_CHARACTERS, MAX_RELAY_ERROR_CHARACTERS, MAX_TIMER_MS, MAX_UPLOAD_SESSIONS_PER_OWNER } from "../../protocol/limits.js";
import type { RelayClient } from "../../types/mcp.js";
import { buildUploadResult } from "../files/buildUploadResult.js";
import { collectUploadFiles } from "../files/collectUploadFiles.js";
import { finalizeUploadGroups } from "../files/finalizeUploadGroups.js";
import { getUploadCleanupFailure, uploadSource } from "../files/uploadSource.js";
import { createUploadGroupRefresher } from "../files/refreshUploadGroups.js";
import { createActionRequest } from "../createActionRequest.js";
import { resultContent } from "../result.js";
import { targetSchema } from "../schema.js";
const uploadTargetSchema = targetSchema.unwrap().refine((target) => Boolean(
  target.elementId?.length || target.locator && [
    target.locator.selector, target.locator.xpath, target.locator.text, target.locator.role,
    target.locator.name, target.locator.label, target.locator.placeholder,
  ].some((value) => value?.length) || Number.isFinite(target.x) && Number.isFinite(target.y)
), "Target must identify a file input by element, locator, or coordinates.");
const uploadPathsSchema = z.array(
  z.string().min(1).refine((path) => path.length <= MAX_FILE_PATH_CHARACTERS, `Path cannot exceed ${MAX_FILE_PATH_CHARACTERS} characters.`),
).min(1).refine((paths) => paths.length <= MAX_UPLOAD_SESSIONS_PER_OWNER, `Paths cannot exceed ${MAX_UPLOAD_SESSIONS_PER_OWNER} items.`);
const rollbackTransfers = async (client: RelayClient, transferIds: string[]) => {
  const uniqueIds = [...new Set(transferIds)];
  if (!uniqueIds.length) return undefined;
  const timeoutMs = 30_000;
  try {
    const result = await client.execute(createActionRequest({
      action: "uploadFile", engine: "native",
      params: { operation: "cancelMany", transferIds: uniqueIds },
      timeoutMs,
    }), AbortSignal.timeout(timeoutMs));
    if (!result.success) return result.error?.message || "Native upload rollback failed.";
    if (!result.data || typeof result.data !== "object" || Array.isArray(result.data)) return "Native upload rollback returned invalid result data.";
    const data = result.data as Record<string, unknown>;
    const counts = [data.requested, data.unique, data.cancelled, data.missing, data.failed];
    if (!counts.every((value) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0) ||
      data.requested !== uniqueIds.length || data.unique !== uniqueIds.length ||
      Number(data.cancelled) + Number(data.missing) + Number(data.failed) !== uniqueIds.length ||
      !Array.isArray(data.failures) || data.failures.length !== data.failed)
      return "Native upload rollback returned inconsistent result data.";
    return data.failed ? JSON.stringify(data.failures).slice(0, MAX_RELAY_ERROR_CHARACTERS) : undefined;
  } catch (error) {
    return error instanceof Error ? error.message : "Native upload rollback failed.";
  }
};
export const registerUploadTool = (server: McpServer, client: RelayClient) => server.registerTool(
  "browser_upload_files",
  {
    title: "Upload files to browser",
    description: "Transfer files or directory contents to the selected browser device, then set the targeted file input.",
    inputSchema: z.strictObject({ paths: uploadPathsSchema, target: uploadTargetSchema, timeoutMs: z.number().int().positive().max(MAX_TIMER_MS).optional() }),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  },
  async ({ paths, target, timeoutMs }, context) => {
    const signal = timeoutMs ? AbortSignal.any([context.mcpReq.signal, AbortSignal.timeout(timeoutMs)]) : context.mcpReq.signal;
    const sources = await collectUploadFiles(paths, signal);
    const transferred: Awaited<ReturnType<typeof uploadSource>>[] = [];
    const refresher = createUploadGroupRefresher(client, signal);
    try {
      for (const source of sources) {
        await refresher.refreshDue(source.directoryGroupId);
        const completed = await uploadSource(client, source, signal, () => refresher.refreshDue(source.directoryGroupId));
        transferred.push(completed);
        refresher.add(source, completed);
      }
      await refresher.refreshDue();
      const directoryGroupIds = sources.flatMap((source) =>
        source.directorySource && source.directoryGroupId ? [source.directoryGroupId] : []);
      const standaloneGroupIds = sources.flatMap((source) =>
        !source.directorySource && source.directoryGroupId ? [source.directoryGroupId] : []);
      const finalizedRoots = await finalizeUploadGroups(client, [...directoryGroupIds, ...standaloneGroupIds], signal);
      const directoryRoots = finalizedRoots.slice(0, new Set(directoryGroupIds).size);
      const standalonePaths = transferred.flatMap((file, index) => sources[index].directorySource ? [] : [file.path]);
      const remotePaths = [...directoryRoots, ...standalonePaths];
      const result = await client.execute(createActionRequest({ action: "setInputFiles", engine: "browser", target, params: { files: remotePaths }, timeoutMs }), signal);
      if (!result.success) throw new Error(result.error?.message || "The browser rejected the transferred files.");
      return resultContent(buildUploadResult(sources, transferred, directoryRoots, result));
    } catch (error) {
      const cleanupFailure = getUploadCleanupFailure(error);
      const transferIds = [...transferred.map(({ transferId }) => transferId), ...(cleanupFailure ? [cleanupFailure.transferId] : [])];
      const rollbackFailure = await rollbackTransfers(client, transferIds);
      if (cleanupFailure || rollbackFailure) {
        const primary = error instanceof Error ? error.message : String(error);
        const bounded = cleanupFailure ? ` Bounded cleanup failed for transfer ${cleanupFailure.transferId}: ${cleanupFailure.message}.` : "";
        const rollback = rollbackFailure ? ` Bulk rollback failed for transfers ${transferIds.join(", ")}: ${rollbackFailure}` : "";
        throw new Error(`${primary}${bounded}${rollback}`, { cause: error });
      }
      throw error;
    }
  },
);
