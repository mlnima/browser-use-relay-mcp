import { sendDebuggerCommand } from "./debugger-session";

type CdpFrame = { id: string; parentId?: string; url: string };
type FrameTree = { frame: CdpFrame; childFrames?: FrameTree[] };
type FrameTreeResult = { frameTree: FrameTree };

const flatten = (tree: FrameTree): CdpFrame[] => [
  tree.frame,
  ...(tree.childFrames || []).flatMap(flatten),
];

export const resolveCdpFrame = async (tabId: number, frameId = 0) => {
  const { frameTree } = await sendDebuggerCommand<FrameTreeResult>(tabId, "Page.getFrameTree");
  if (frameId === 0) return frameTree.frame.id;
  const browserFrames = await chrome.webNavigation.getAllFrames({ tabId }) || [];
  const cdpFrames = flatten(frameTree);
  const mapping = new Map<number, string>([[0, frameTree.frame.id]]);
  const used = new Set<string>([frameTree.frame.id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const frame of browserFrames) {
      if (mapping.has(frame.frameId)) continue;
      const parent = mapping.get(frame.parentFrameId);
      if (!parent) continue;
      const match = cdpFrames.find((candidate) => !used.has(candidate.id) && candidate.parentId === parent && candidate.url === frame.url);
      if (!match) continue;
      mapping.set(frame.frameId, match.id);
      used.add(match.id);
      changed = true;
    }
  }
  const resolved = mapping.get(frameId);
  if (!resolved) throw new Error(`Unable to map browser frame ${frameId} to its debugger context.`);
  return resolved;
};
