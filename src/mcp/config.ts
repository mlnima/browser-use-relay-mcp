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

const readDelay = (value: string | undefined) => {
  if (value === undefined || value === "") return undefined;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0 || number > MAX_TIMER_MS)
    throw new Error(`Action delay must be an integer from 0 to ${MAX_TIMER_MS} milliseconds.`);
  return number;
};

export const resolveMcpConfiguration = (): McpConfiguration => {
  const relayUrl = readArgument("--relay-url") || process.env.BROWSER_RELAY_URL;
  if (!relayUrl) throw new Error("Set BROWSER_RELAY_URL or pass --relay-url for the selected browser relay.");
  const parsed = new URL(relayUrl);
  if (parsed.protocol !== "ws:") throw new Error("The relay URL must use ws:// because the relay does not provide TLS.");
  if (parsed.hash) throw new Error("The relay URL cannot contain a fragment.");
  const actionDelayMinMs = readDelay(readArgument("--action-delay-min-ms") ?? process.env.BROWSER_RELAY_ACTION_DELAY_MIN_MS);
  const actionDelayMaxMs = readDelay(readArgument("--action-delay-max-ms") ?? process.env.BROWSER_RELAY_ACTION_DELAY_MAX_MS);
  if (actionDelayMinMs !== undefined && actionDelayMaxMs !== undefined && actionDelayMaxMs < actionDelayMinMs)
    throw new Error("Maximum action delay must be greater than or equal to minimum action delay.");
  return {
    relayUrl: parsed.href,
    actionDelayMinMs,
    actionDelayMaxMs,
    connectTimeoutMs: readPositiveNumber(process.env.BROWSER_RELAY_CONNECT_TIMEOUT_MS, 10_000),
    actionTimeoutMs: readPositiveNumber(process.env.BROWSER_RELAY_ACTION_TIMEOUT_MS, 60_000),
  };
};
