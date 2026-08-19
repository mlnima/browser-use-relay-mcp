#!/usr/bin/env node
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createMcpServer } from "./createMcpServer.js";
import { resolveMcpConfiguration } from "./config.js";
import { createRelayClient } from "./relay/createRelayClient.js";

const start = async () => {
  const configuration = resolveMcpConfiguration();
  const client = createRelayClient(configuration.relayUrl, configuration.connectTimeoutMs, configuration.actionTimeoutMs);
  const handle = serveStdio(() => createMcpServer(client));
  let stopping: Promise<void> | undefined;
  const stop = () => stopping ||= Promise.allSettled([handle.close(), client.close()]).then((results) => {
    const failure = results.find((result) => result.status === "rejected");
    if (failure?.status === "rejected") throw failure.reason;
  });
  const requestStop = () => void stop().catch((error: Error) => (process.stderr.write(`${error.message}\n`), process.exitCode = 1));
  process.stdin.once("end", requestStop);
  process.stdin.once("close", requestStop);
  process.once("SIGINT", requestStop);
  process.once("SIGTERM", requestStop);
};

start().catch((error: Error) => (process.stderr.write(`${error.message}\n`), process.exitCode = 1));
