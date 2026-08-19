import { clearObservedRequests } from "../browser-api/request-observer";
import { clearRelayNetworkRules } from "../browser-api/network";
import { clearInjectedCss } from "../browser-api/css";
import { closeCaptureDocument } from "../browser-api/tab-capture/offscreen-document";
import { clearCdpRequests } from "../debugger/cdp-network-store";
import { detachAllDebuggers } from "../debugger/debugger-session";
import { releaseBrowserInput } from "../debugger/release-browser-input";

type NativeActions = { close: (message: string) => void };
let cleanup = Promise.resolve();

export const resetControlSession = (
  controllers: Map<string, AbortController>,
  executions: Set<Promise<unknown>>,
  nativeActions: NativeActions,
  message: string,
  barrier?: Promise<unknown>,
) => {
  const active = [...executions];
  controllers.forEach((controller) => controller.abort(new Error(message)));
  nativeActions.close(message);
  clearObservedRequests();
  clearCdpRequests();
  const captureClose = closeCaptureDocument().then(() => undefined, () => undefined);
  cleanup = cleanup.then(async () => {
    await Promise.allSettled([Promise.allSettled(active), captureClose, barrier]);
    await releaseBrowserInput();
    await Promise.allSettled([
      clearInjectedCss(),
      clearRelayNetworkRules("all"),
      detachAllDebuggers(),
    ]);
  });
  return cleanup;
};

export const waitForControlSession = async () => {
  let current: Promise<void>;
  do {
    current = cleanup;
    await current;
  } while (current !== cleanup);
};
