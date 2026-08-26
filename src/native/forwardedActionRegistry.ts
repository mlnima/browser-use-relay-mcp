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
  const publicIds = new Map<WebSocket, Map<string, string>>();
  const sessionId = randomUUID();
  const ownerByExtensionId = new Map<string, WebSocket>();
  const extensionPrefix = `${sessionId}:`;
  let generation = 0;
  const createId = () => `${extensionPrefix}${generation += 1}`;
  const publicIdsFor = (socket: WebSocket) => {
    const current = publicIds.get(socket);
    if (current) return current;
    const created = new Map<string, string>();
    publicIds.set(socket, created);
    return created;
  };
  const parentExtensionId = (id: string) => {
    if (!id.startsWith(extensionPrefix)) return undefined;
    const value = id.slice(extensionPrefix.length).split(":", 1)[0];
    return value && /^\d+$/.test(value) ? `${extensionPrefix}${value}` : undefined;
  };
  const add = (action: ForwardedAction) => {
    const extensionId = createId();
    pending.set(extensionId, action);
    publicIdsFor(action.socket).set(action.request.id, extensionId);
    ownerByExtensionId.set(extensionId, action.socket);
    return extensionId;
  };
  const remove = (extensionId: string) => {
    const action = pending.get(extensionId);
    if (!action) return undefined;
    pending.delete(extensionId);
    const ownedIds = publicIds.get(action.socket);
    if (ownedIds?.get(action.request.id) === extensionId) ownedIds.delete(action.request.id);
    if (ownedIds && !ownedIds.size) publicIds.delete(action.socket);
    ownerByExtensionId.delete(extensionId);
    return action;
  };
  const takeResult = (extensionId: string) => remove(extensionId);
  const takePublic = (id: string, socket: WebSocket, expectedExtensionId?: string) => {
    const extensionId = publicIds.get(socket)?.get(id);
    const action = extensionId ? pending.get(extensionId) : undefined;
    if (!extensionId || !action || action.socket !== socket ||
      expectedExtensionId && extensionId !== expectedExtensionId) return undefined;
    remove(extensionId);
    return { extensionId, action };
  };
  const activePublicIdsFor = (socket: WebSocket) => [...pending.values()]
    .filter((action) => action.socket === socket).map((action) => action.request.id);
  return {
    add, takeResult, takePublic, publicIdsFor: activePublicIdsFor,
    ownerForExtensionAction: (id: string) => ownerByExtensionId.get(parentExtensionId(id) || ""),
    isForwardedExtensionAction: (id: string) => parentExtensionId(id) !== undefined,
    activePublicActions: () => [...pending.values()].map((action) => ({ id: action.request.id, socket: action.socket })),
    has: (id: string, socket: WebSocket) => publicIds.get(socket)?.has(id) === true,
  };
};
