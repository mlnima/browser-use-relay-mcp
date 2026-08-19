import type { McpConfiguration } from "../types/mcp.js";
import { MAX_TIMER_MS } from "../protocol/limits.js";

const readArgument = (name: string) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const readPositiveNumber = (value: string | undefined, fallback: number) => {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 && number <= MAX_TIMER_MS ? number : fallback;
};

export const resolveMcpConfiguration = (): McpConfiguration => {
  const relayUrl = readArgument("--relay-url") || process.env.BROWSER_RELAY_URL;
  if (!relayUrl) throw new Error("Set BROWSER_RELAY_URL or pass --relay-url for the selected browser relay.");
  const parsed = new URL(relayUrl);
  if (parsed.protocol !== "ws:") throw new Error("The relay URL must use ws:// because the relay does not provide TLS.");
  if (parsed.hash) throw new Error("The relay URL cannot contain a fragment.");
  return {
    relayUrl: parsed.href,
    connectTimeoutMs: readPositiveNumber(process.env.BROWSER_RELAY_CONNECT_TIMEOUT_MS, 10_000),
    actionTimeoutMs: readPositiveNumber(process.env.BROWSER_RELAY_ACTION_TIMEOUT_MS, 60_000),
  };
};
