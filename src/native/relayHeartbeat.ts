import WebSocket from "ws";
import { RELAY_HEARTBEAT_INTERVAL_MS, RELAY_PONG_TIMEOUT_MS } from "./constants.js";

export const startRelayHeartbeat = (socket: WebSocket) => {
  let deadline: NodeJS.Timeout | undefined;
  const pong = () => {
    if (deadline) clearTimeout(deadline);
    deadline = undefined;
  };
  const ping = () => {
    if (socket.readyState !== WebSocket.OPEN) return;
    try {
      socket.ping();
      if (deadline) clearTimeout(deadline);
      deadline = setTimeout(() => socket.terminate(), RELAY_PONG_TIMEOUT_MS);
      deadline.unref();
    } catch {
      socket.terminate();
    }
  };
  const interval = setInterval(ping, RELAY_HEARTBEAT_INTERVAL_MS);
  interval.unref();
  socket.on("pong", pong);
  return () => {
    clearInterval(interval);
    if (deadline) clearTimeout(deadline);
    socket.removeListener("pong", pong);
  };
};
