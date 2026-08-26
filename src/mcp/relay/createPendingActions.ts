import type { ActionResult } from "../../types/action.js";
import type WebSocket from "ws";

export type PendingAction = {
  resolve: (result: ActionResult) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
  signal?: AbortSignal;
  onAbort?: () => void;
  socket: WebSocket;
};

export const createPendingActions = () => {
  const items = new Map<string, PendingAction>();
  const take = (id: string) => {
    const item = items.get(id);
    if (!item) return undefined;
    items.delete(id);
    clearTimeout(item.timer);
    if (item.signal && item.onAbort) item.signal.removeEventListener("abort", item.onAbort);
    return item;
  };
  const rejectAll = (message: string) => {
    for (const id of [...items.keys()]) take(id)?.reject(new Error(message));
  };
  const rejectSocket = (socket: WebSocket, message: string) => {
    for (const [id, item] of [...items]) if (item.socket === socket) take(id)?.reject(new Error(message));
  };
  return { add: (id: string, item: PendingAction) => items.set(id, item), has: (id: string) => items.has(id), take, rejectAll, rejectSocket };
};

export type PendingActions = ReturnType<typeof createPendingActions>;
