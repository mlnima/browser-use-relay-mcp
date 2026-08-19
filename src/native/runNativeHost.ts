import type { NativeMessage } from "../types/relay.js";
import type { RelaySettings } from "../types/settings.js";
import { createActionCoordinator } from "./createActionCoordinator.js";
import { createRelayState } from "./createRelayState.js";
import { createRelayTransport } from "./createRelayTransport.js";
import { normalizeRelaySettings, relayHost, requestedRelayPort } from "./nativeConfiguration.js";
import { flushNativeMessages, readNativeMessages, writeNativeMessage } from "./nativeMessaging.js";
import { relayAddresses } from "./relayAddresses.js";
import { selectRelayNetworkAddress } from "./relayNetworkAddress.js";
import { isBrowserNativeMessage } from "./nativeMessageValidation.js";

export const runNativeHost = async () => {
  let outputFailure: Error | undefined;
  let shutdownPromise: Promise<void> | undefined;
  const outputFailed = (error: unknown) => {
    if (outputFailure) return;
    outputFailure = error instanceof Error ? error : new Error(String(error));
    process.exitCode = 1;
    process.stdin.pause();
    process.stderr.write(`Native messaging output failed: ${outputFailure.message}\n`);
    void shutdown().finally(() => process.exit(1));
  };
  const write = (message: NativeMessage) => void writeNativeMessage(message).catch(outputFailed);
  const state = createRelayState(write);
  const actions = createActionCoordinator(write);
  const transport = createRelayTransport({
    action: actions.onRelayAction,
    cancel: actions.onRelayCancel,
    disconnect: actions.onSocketClose,
    clients: state.connected,
    error: state.failed,
  });
  let configureQueue = Promise.resolve();

  const configure = async (generation: number, input: RelaySettings) => {
    const settings = normalizeRelaySettings(input);
    try {
      await transport.stop();
      if (!settings.enabled) {
        state.configured(generation, settings, {}, false);
        return;
      }
      const networkAddress = settings.externalAccess ? selectRelayNetworkAddress() : undefined;
      const port = await transport.start(relayHost(settings), requestedRelayPort(settings));
      const active = { ...settings, port };
      state.configured(generation, active, relayAddresses(networkAddress), true);
    } catch (error) {
      state.configured(generation, settings, {}, false, error instanceof Error ? error.message : String(error));
    }
  };
  const quiesce = (generation: number) => transport.stop()
    .then(() => write({ type: "quiesced", generation }));

  const handle = (input: unknown) => {
    if (!isBrowserNativeMessage(input)) {
      state.failed("The browser native message was invalid.");
      return;
    }
    const message = input;
    switch (message.type) {
      case "configure":
        configureQueue = configureQueue.catch(() => undefined).then(() => configure(message.generation, message.settings));
        break;
      case "quiesce":
        configureQueue = configureQueue.catch(() => undefined).then(() => quiesce(message.generation));
        break;
      case "actionResult": actions.onExtensionResult(message.result); break;
      case "actionRequest": actions.onExtensionAction(message.request); break;
      case "cancel": void actions.onExtensionCancel(message.id, message.reason); break;
      case "event": transport.broadcast(message); break;
    }
  };

  const shutdown = () => shutdownPromise ||= (async () => {
    await configureQueue.catch(() => undefined);
    await transport.stop();
    await actions.close();
    await flushNativeMessages();
  })();

  const signalShutdown = () => void shutdown().finally(() => process.exit(process.exitCode || 0));
  process.once("SIGINT", signalShutdown);
  process.once("SIGTERM", signalShutdown);
  await readNativeMessages(handle).catch((error: unknown) => {
    process.exitCode = 1;
    const message = error instanceof Error ? error.message : String(error);
    state.failed(message.slice(0, 4_096));
  });
  await shutdown();
};
