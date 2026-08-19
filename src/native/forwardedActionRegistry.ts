import { randomUUID } from "node:crypto";
import type WebSocket from "ws";
import type { ActionRequest } from "../types/action.js";

export type ForwardedAction = {
  request: ActionRequest;
  socket: WebSocket;
  timer: NodeJS.Timeout;
  startedAt: number;
};

export const createForwardedActionRegistry = () => {
  const pending = new Map<string, ForwardedAction>();
  const publicIds = new Map<string, string>();
  const sessionId = randomUUID();
  const ownerByExtensionId = new Map<string, WebSocket>();
  const extensionPrefix = `${sessionId}:`;
  let generation = 0;
  const createId = () => `${extensionPrefix}${generation += 1}`;
  const parentExtensionId = (id: string) => {
    if (!id.startsWith(extensionPrefix)) return undefined;
    const value = id.slice(extensionPrefix.length).split(":", 1)[0];
    return value && /^\d+$/.test(value) ? `${extensionPrefix}${value}` : undefined;
  };
  const add = (action: ForwardedAction) => {
    const extensionId = createId();
    pending.set(extensionId, action);
    publicIds.set(action.request.id, extensionId);
    ownerByExtensionId.set(extensionId, action.socket);
    return extensionId;
  };
  const remove = (extensionId: string) => {
    const action = pending.get(extensionId);
    if (!action) return undefined;
    pending.delete(extensionId);
    publicIds.delete(action.request.id);
    ownerByExtensionId.delete(extensionId);
    return action;
  };
  const takeResult = (extensionId: string) => remove(extensionId);
  const takePublic = (id: string, socket?: WebSocket, expectedExtensionId?: string) => {
    const extensionId = publicIds.get(id);
    const action = extensionId ? pending.get(extensionId) : undefined;
    if (!extensionId || !action || socket && action.socket !== socket ||
      expectedExtensionId && extensionId !== expectedExtensionId) return undefined;
    remove(extensionId);
    return { extensionId, action };
  };
  const publicIdsFor = (socket: WebSocket) => [...pending.values()]
    .filter((action) => action.socket === socket).map((action) => action.request.id);
  const countOwner = (owner: object) => [...pending.values()]
    .filter((action) => action.socket === owner).length;
  return {
    add, takeResult, takePublic, publicIdsFor, countOwner,
    ownerForExtensionAction: (id: string) => ownerByExtensionId.get(parentExtensionId(id) || ""),
    isForwardedExtensionAction: (id: string) => parentExtensionId(id) !== undefined,
    activePublicIds: () => [...publicIds.keys()],
    has: (id: string) => publicIds.has(id),
    count: () => pending.size,
  };
};
