import { sendDebuggerCommand } from "./debugger-session";

type CdpFrame = { id: string; parentId?: string };
type FrameTree = { frame: CdpFrame; childFrames?: FrameTree[] };
type FrameTreeResult = { frameTree: FrameTree };
type FrameOwner = { backendNodeId: number };

const flatten = (tree: FrameTree): CdpFrame[] => [
  tree.frame,
  ...(tree.childFrames || []).flatMap(flatten),
];

export const scrollFrameChainIntoView = async (tabId: number, targetFrameId: string, signal?: AbortSignal) => {
  const { frameTree } = await sendDebuggerCommand<FrameTreeResult>(tabId, "Page.getFrameTree");
  const parents = new Map(flatten(frameTree).map((frame) => [frame.id, frame.parentId]));
  if (!parents.has(targetFrameId)) throw new Error("The target debugger frame is no longer available.");
  const children: string[] = [];
  let current = targetFrameId;
  while (parents.get(current)) {
    children.unshift(current);
    current = parents.get(current)!;
  }
  let targetOwner: FrameOwner | undefined;
  for (const frameId of children) {
    signal?.throwIfAborted();
    const owner = await sendDebuggerCommand<FrameOwner>(tabId, "DOM.getFrameOwner", { frameId });
    await sendDebuggerCommand(tabId, "DOM.scrollIntoViewIfNeeded", { backendNodeId: owner.backendNodeId });
    if (frameId === targetFrameId) targetOwner = owner;
  }
  if (!targetOwner) throw new Error("The target frame has no parent frame owner.");
  return targetOwner;
};
