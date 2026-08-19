import type { JsonValue } from "../../../../src/types/json.js";
import { MAX_SNAPSHOT_STRING_CHARACTERS, MAX_SNAPSHOT_TEXT_SCAN_NODES } from "../../../../src/protocol/limits.js";
import { createSnapshotStringLimiter } from "../../shared/snapshot-limit.js";
import { getDeepActiveElement } from "./element-tree.js";
import { registerElement } from "./registry.js";

type LimitString = ReturnType<typeof createSnapshotStringLimiter>["limit"];

const getSelectionState = (limit: LimitString): JsonValue => {
  const selection = document.getSelection();
  if (!selection?.rangeCount) return selection ? { text: "", collapsed: selection.isCollapsed, rangeCount: 0, truncated: false } : null;
  const range = selection.getRangeAt(0);
  const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_ALL);
  let text = "", nodes = 0, characterTruncated = false;
  const visit = (node: Node) => {
    nodes += 1;
    if (!(node instanceof Text) || !range.intersectsNode(node)) return;
    const start = node === range.startContainer ? range.startOffset : 0;
    const end = node === range.endContainer ? range.endOffset : node.data.length;
    const remaining = MAX_SNAPSHOT_STRING_CHARACTERS + 1 - text.length;
    text += node.data.slice(start, start + Math.min(Math.max(0, end - start), remaining));
    characterTruncated ||= end - start > remaining;
  };
  visit(range.commonAncestorContainer);
  let node: Node | null;
  while (!characterTruncated && nodes < MAX_SNAPSHOT_TEXT_SCAN_NODES && (node = walker.nextNode())) visit(node);
  const scanTruncated = !characterTruncated && nodes >= MAX_SNAPSHOT_TEXT_SCAN_NODES && Boolean(walker.nextNode());
  characterTruncated ||= text.length > MAX_SNAPSHOT_STRING_CHARACTERS;
  return { text: limit(text)!, collapsed: selection.isCollapsed, rangeCount: selection.rangeCount,
    truncated: characterTruncated || scanTruncated,
    ...(characterTruncated ? { truncationReason: "characterLimit" } : scanTruncated ? { truncationReason: "scanLimit" } : {}) };
};

export const createPageState = (): Record<string, JsonValue> => {
  const root = document.scrollingElement || document.documentElement;
  const activeElement = getDeepActiveElement();
  const favicon = document.querySelector<HTMLLinkElement>('link[rel~="icon"]')?.href || null;
  const limiter = createSnapshotStringLimiter();
  const selection = getSelectionState(limiter.limit);
  const selectionRecord = selection && typeof selection === "object" && !Array.isArray(selection) ? selection as Record<string, JsonValue> : undefined;
  if (selectionRecord?.truncationReason === "scanLimit") limiter.stats.truncatedStrings += 1;
  return {
    url: limiter.limit(location.href)!,
    title: limiter.limit(document.title)!,
    favicon: favicon ? limiter.limit(favicon)! : null,
    viewport: { width: innerWidth, height: innerHeight },
    document: { width: root.scrollWidth, height: root.scrollHeight },
    scroll: { x: scrollX, y: scrollY },
    activeElementId: activeElement ? registerElement(activeElement) : null,
    selection,
    devicePixelRatio,
    language: limiter.limit(document.documentElement.lang || navigator.language)!,
    visibility: document.visibilityState,
    online: navigator.onLine,
    readyState: document.readyState,
    historyLength: history.length,
    linkCount: document.links.length,
    formCount: document.forms.length,
    outputLimits: {
      stringCharacterLimit: MAX_SNAPSHOT_STRING_CHARACTERS,
      stringTruncationCount: limiter.stats.truncatedStrings,
    },
  };
};
