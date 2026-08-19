import WebSocket from "ws";
import { PACKAGE_NAME, RELAY_PROTOCOL_VERSION } from "../../protocol/version.js";
import { parseRelayHandshake, type RelayHandshake } from "./parseRelayMessage.js";
import { startRelayHeartbeat } from "./startRelayHeartbeat.js";

type CloseHandler = (socket: WebSocket) => void;
type RelayHandshakeError = Error & { relayCode?: string };

export const relayHandshakeCode = (error: unknown) => error instanceof Error
  ? (error as RelayHandshakeError).relayCode
  : undefined;
const handshakeError = (message: string, code?: string) => Object.assign(new Error(message), { relayCode: code });

export const openRelaySocket = (
  url: string,
  timeoutMs: number,
  signal: AbortSignal,
  receive: (data: WebSocket.RawData, socket: WebSocket, binary: boolean) => void,
  closed: CloseHandler,
) => new Promise<WebSocket>((resolve, reject) => {
  const socket = new WebSocket(url, { handshakeTimeout: timeoutMs, maxPayload: 64 * 1024 * 1024 });
  let settled = false;
  const timer = setTimeout(() => terminate(new Error("Relay connection timed out.")), timeoutMs);
  const cleanup = () => {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
    socket.removeListener("error", fail);
    socket.removeListener("close", closedBeforeReady);
    socket.removeListener("message", handshake);
  };
  const fail = (error: Error) => {
    if (settled) return;
    settled = true;
    cleanup();
    reject(error);
  };
  const terminate = (error: Error) => {
    fail(error);
    socket.once("error", () => undefined);
    socket.terminate();
  };
  const abort = () => terminate(signal.reason instanceof Error ? signal.reason : new Error("Relay connection cancelled."));
  const closedBeforeReady = () => fail(new Error("Relay connection closed before its handshake completed."));
  const handshake = (data: WebSocket.RawData, binary: boolean) => {
    if (binary) return terminate(handshakeError("Relay returned a binary handshake message.", "PROTOCOL_MISMATCH"));
    let message: RelayHandshake | undefined;
    try {
      message = parseRelayHandshake(data);
    } catch {
      terminate(handshakeError("Relay returned an invalid handshake message.", "PROTOCOL_MISMATCH"));
      return;
    }
    if (!message || message.name !== "relay.ready" || message.data?.protocolVersion !== RELAY_PROTOCOL_VERSION) {
      const rejected = message?.name === "relay.error";
      terminate(rejected
        ? handshakeError(message?.data?.message || "Relay rejected the handshake.", message?.data?.code || "RELAY_REJECTED")
        : handshakeError("Relay returned an incompatible handshake.", "PROTOCOL_MISMATCH"));
      return;
    }
    if (settled) return;
    settled = true;
    cleanup();
    const stopHeartbeat = startRelayHeartbeat(socket);
    socket.on("message", (payload, isBinary) => receive(payload, socket, isBinary));
    socket.once("close", () => (stopHeartbeat(), closed(socket)));
    socket.on("error", (error) => process.stderr.write(`Relay error: ${error.message}\n`));
    receive(data, socket, false);
    resolve(socket);
  };
  signal.addEventListener("abort", abort, { once: true });
  socket.once("error", fail);
  socket.once("close", closedBeforeReady);
  socket.once("open", () => {
    if (settled) return;
    socket.on("message", handshake);
    socket.send(
      JSON.stringify({ type: "hello", protocolVersion: RELAY_PROTOCOL_VERSION, client: "mcp", name: PACKAGE_NAME }),
      (error) => error && terminate(error),
    );
  });
  if (signal.aborted) abort();
});
