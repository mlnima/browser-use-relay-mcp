import { useCallback, useEffect, useState } from "react";
import { runtimeMessage } from "./messages";
import type { RuntimeRequest, StateChangedMessage } from "./messages";
import type { ExtensionState } from "./model";
import { sendRuntimeRequest } from "./runtime";

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "The extension service is unavailable.";

export const useExtensionState = () => {
  const [state, setState] = useState<ExtensionState>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  const refresh = useCallback(async () => {
    setError(undefined);
    try {
      setState(await sendRuntimeRequest({ type: runtimeMessage.getState }));
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  const update = useCallback(async (request: RuntimeRequest) => {
    setError(undefined);
    setPending(true);
    try {
      const nextState = await sendRuntimeRequest(request);
      setState(nextState);
      return nextState;
    } catch (requestError) {
      setError(errorMessage(requestError));
      return undefined;
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const receiveState = (message: StateChangedMessage) => {
      if (message?.type !== runtimeMessage.stateChanged) return;
      setState(message.state);
      setError(undefined);
    };
    chrome.runtime.onMessage.addListener(receiveState);
    return () => chrome.runtime.onMessage.removeListener(receiveState);
  }, [refresh]);

  return { state, error, loading, pending, refresh, update };
};
