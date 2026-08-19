import type { ExtensionState } from "./model";
import type { RuntimeRequest, RuntimeResponse } from "./messages";

export const sendRuntimeRequest = async (
  request: RuntimeRequest,
): Promise<ExtensionState> => {
  const response = (await chrome.runtime.sendMessage(request)) as RuntimeResponse | undefined;

  if (!response?.ok) {
    throw new Error(response?.error || "The extension service is unavailable.");
  }

  return response.state;
};
