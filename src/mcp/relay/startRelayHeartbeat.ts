import WebSocket from "ws";

const intervalMs = 20_000;
const timeoutMs = 10_000;

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
      deadline = setTimeout(() => socket.terminate(), timeoutMs);
      deadline.unref();
    } catch {
      socket.terminate();
    }
  };
  const interval = setInterval(ping, intervalMs);
  interval.unref();
  socket.on("pong", pong);
  return () => {
    clearInterval(interval);
    if (deadline) clearTimeout(deadline);
    socket.removeListener("pong", pong);
  };
};
