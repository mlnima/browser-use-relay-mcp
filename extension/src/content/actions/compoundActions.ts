import type { JsonValue } from "../../../../src/types/json.js";
import { MAX_COMPOUND_ACTION_INTERVAL_MS, MAX_COMPOUND_ACTION_ITERATIONS, MAX_CONTENT_QUERY_OFFSET, MAX_CONTENT_QUERY_RESULTS, MAX_CONTENT_TABLE_CELLS, MAX_CONTENT_TABLE_ROWS, MAX_CONTENT_VALUE_BYTES, MAX_SNAPSHOT_STRING_CHARACTERS } from "../../../../src/protocol/limits.js";
import type { ContentActionHandler } from "./types.js";
import { requireElement, requireHtmlElement, toJsonValueWithBytes } from "./element.js";
import { queryInteger, visitElements } from "./query-all";
import { textActionHandlers } from "./textActions";
import { formActionHandlers } from "./formActions";
import { isElementVisible } from "../catalog/element-state";
import { collectBoundedElementText } from "../catalog/text.js";
import { requireActionableElement } from "./actionable-element";
import { createSnapshotStringLimiter } from "../../shared/snapshot-limit.js";
const boundedText = (element: Element, limiter: ReturnType<typeof createSnapshotStringLimiter>) => {
  const result = collectBoundedElementText(element, MAX_SNAPSHOT_STRING_CHARACTERS + 1);
  if (result.truncated && (result.value?.length || 0) <= MAX_SNAPSHOT_STRING_CHARACTERS) limiter.stats.truncatedStrings += 1;
  return limiter.limit(result.value) || "";
};
const extractTable = (element: Element) => {
  const table = element instanceof HTMLTableElement ? element : element.closest("table");
  if (!table) throw new Error("The target is not inside a table.");
  const limiter = createSnapshotStringLimiter(), rows: JsonValue[] = [];
  let cellCount = 0, rowIndex = 0, cellTruncated = false; while (rowIndex < table.rows.length && rowIndex < MAX_CONTENT_TABLE_ROWS && cellCount < MAX_CONTENT_TABLE_CELLS) {
    const row = table.rows.item(rowIndex)!, cells: JsonValue[] = [];
    for (let index = 0; index < row.cells.length && cellCount < MAX_CONTENT_TABLE_CELLS; index += 1) {
      const cell = row.cells.item(index)!;
      cells.push({ text: boundedText(cell, limiter), header: cell.tagName === "TH", colSpan: cell.colSpan, rowSpan: cell.rowSpan }); cellCount += 1;
    }
    cellTruncated ||= cells.length < row.cells.length; rows.push(cells); rowIndex += 1;
  }
  return { caption: table.caption ? boundedText(table.caption, limiter) : null, rows,
    totalRowCount: table.rows.length, returnedRowCount: rows.length, returnedCellCount: cellCount, truncated: cellTruncated || rowIndex < table.rows.length,
    outputLimits: { rowLimit: MAX_CONTENT_TABLE_ROWS, cellLimit: MAX_CONTENT_TABLE_CELLS, stringCharacterLimit: MAX_SNAPSHOT_STRING_CHARACTERS, stringTruncationCount: limiter.stats.truncatedStrings } };
};
const extractLinks = (rawLimit: JsonValue | undefined, rawOffset: JsonValue | undefined): JsonValue => {
  const limit = queryInteger(rawLimit, MAX_CONTENT_QUERY_RESULTS, 1, MAX_CONTENT_QUERY_RESULTS, "limit");
  const offset = queryInteger(rawOffset, 0, 0, MAX_CONTENT_QUERY_OFFSET, "offset");
  const limiter = createSnapshotStringLimiter();
  const links: JsonValue[] = [];
  let matched = 0, encodedBytes = 2;
  let truncationReason: "limit" | "byteLimit" | undefined;
  visitElements("a[href]", (element) => {
    if (!isElementVisible(element)) return;
    matched += 1;
    if (matched <= offset) return;
    if (links.length >= limit) { truncationReason = "limit"; return false; }
    const link = element as HTMLAnchorElement;
    const output = toJsonValueWithBytes({
      text: boundedText(link, limiter), url: limiter.limit(link.href)!,
      target: limiter.limit(link.target || undefined) || null, rel: limiter.limit(link.rel || undefined) || null,
    }, MAX_CONTENT_VALUE_BYTES, "Link descriptor");
    const requiredBytes = output.encodedBytes + Number(links.length > 0);
    if (encodedBytes + requiredBytes > MAX_CONTENT_VALUE_BYTES) { truncationReason = "byteLimit"; return false; }
    links.push(output.value);
    encodedBytes += requiredBytes;
  });
  const truncated = Boolean(truncationReason);
  return {
    links, offset, limit, returnedLinkCount: links.length, totalMatched: truncated ? null : matched,
    truncated, nextOffset: truncated ? offset + links.length : null, encodedBytes,
    byteLimit: MAX_CONTENT_VALUE_BYTES, stringTruncationCount: limiter.stats.truncatedStrings,
    ...(truncationReason && { truncationReason }),
  };
};
const wait = (milliseconds: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  let settled = false;
  const finish = (callback: () => void) => { if (!settled) (settled = true, clearTimeout(timer), signal.removeEventListener("abort", abort), callback()); };
  const abort = () => finish(() => reject(signal.reason instanceof Error ? signal.reason : new Error("Action cancelled.")));
  const timer = setTimeout(() => finish(resolve), milliseconds);
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
});
const requireValue = (params: Record<string, unknown> | undefined) => { if (!Object.prototype.hasOwnProperty.call(params || {}, "value")) throw new Error("params.value is required."); };
export const compoundActionHandlers: Record<string, ContentActionHandler> = {
  fillField: async (context) => (requireValue(context.request.params), textActionHandlers.setValue({ ...context, target: await requireActionableElement(context.target) })),
  findAndFill: async (context) => (requireValue(context.request.params), textActionHandlers.setValue({ ...context, target: await requireActionableElement(context.target) })),
  chooseOption: async (context) => formActionHandlers.selectOption({ ...context, target: await requireActionableElement(context.target) }),
  extractTable: async ({ target }) => extractTable(requireElement(target)),
  extractLinks: async ({ request }) => extractLinks(request.params?.limit, request.params?.offset),
  scrollUntilFound: async ({ request, resolveTarget, signal }) => {
    const limit = queryInteger(request.params?.maxScrolls, 20, 0, MAX_COMPOUND_ACTION_ITERATIONS, "maxScrolls");
    const intervalMs = queryInteger(request.params?.intervalMs, 250, 1, MAX_COMPOUND_ACTION_INTERVAL_MS, "intervalMs");
    if (resolveTarget()) return { found: true, scrolls: 0 };
    for (let index = 0; index < limit; index += 1) {
      window.scrollBy({ top: Number(request.params?.step ?? innerHeight * 0.8), behavior: "smooth" });
      await wait(intervalMs, signal);
      if (resolveTarget()) return { found: true, scrolls: index + 1 };
    }
    return { found: false, scrolls: limit };
  },
  clickUntilGone: async ({ request, resolveTarget, signal }) => {
    const limit = queryInteger(request.params?.maxClicks, 20, 0, MAX_COMPOUND_ACTION_ITERATIONS, "maxClicks");
    const intervalMs = queryInteger(request.params?.intervalMs, 200, 1, MAX_COMPOUND_ACTION_INTERVAL_MS, "intervalMs");
    for (let index = 0; index < limit; index += 1) {
      const element = resolveTarget();
      if (!element) return { gone: true, clicks: index };
      requireHtmlElement(await requireActionableElement(element)).click();
      await wait(intervalMs, signal);
    }
    return { gone: !resolveTarget(), clicks: limit };
  },
};
