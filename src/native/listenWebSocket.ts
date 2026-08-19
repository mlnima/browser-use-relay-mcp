import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocketServer } from "ws";
import type WebSocket from "ws";
import {
  MAX_RELAY_TCP_CONNECTIONS, MAX_WS_INBOUND_MESSAGE_BYTES, RELAY_HANDSHAKE_TIMEOUT_MS,
} from "./constants.js";

const listen = (
  host: string,
  port: number,
  connection: (socket: WebSocket) => void,
) => new Promise<{ server: WebSocketServer; httpServer: ReturnType<typeof createServer>; port: number }>((resolve, reject) => {
  const httpServer = createServer((_request, response) => {
    response.writeHead(426, { Connection: "close" });
    response.end();
  });
  httpServer.maxConnections = MAX_RELAY_TCP_CONNECTIONS;
  httpServer.headersTimeout = RELAY_HANDSHAKE_TIMEOUT_MS;
  httpServer.requestTimeout = RELAY_HANDSHAKE_TIMEOUT_MS;
  httpServer.setTimeout(RELAY_HANDSHAKE_TIMEOUT_MS, (socket) => socket.destroy());
  const server = new WebSocketServer({ server: httpServer, maxPayload: MAX_WS_INBOUND_MESSAGE_BYTES });
  server.on("connection", connection);
  let settled = false;
  const fail = (error: Error) => {
    if (settled) return;
    settled = true;
    httpServer.closeAllConnections();
    httpServer.close();
    server.close();
    reject(error);
  };
  httpServer.on("error", fail);
  server.on("error", fail);
  httpServer.once("listening", () => {
    if (settled) return;
    settled = true;
    httpServer.removeListener("error", fail);
    server.removeListener("error", fail);
    resolve({ server, httpServer, port: (httpServer.address() as AddressInfo).port });
  });
  httpServer.listen({ port, host, backlog: MAX_RELAY_TCP_CONNECTIONS });
});

export const listenWebSocket = async (
  host: string,
  requestedPort: number,
  connection: (socket: WebSocket) => void,
) => {
  try {
    return await listen(host, requestedPort, connection);
  } catch {
    return listen(host, 0, connection);
  }
};
