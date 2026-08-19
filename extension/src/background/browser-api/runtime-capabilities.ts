import type { BrowserApiHandler } from "./types.js";
import { toJson } from "./json.js";
import { listCoreCapabilities } from "./core-capabilities.js";
import { listDataCapabilities } from "./data-capabilities.js";
import { getState } from "../state/state-store";

export const handleRuntimeCapabilitiesAction: BrowserApiHandler = async (request) => {
  if (request.action !== "getRuntimeCapabilities") return undefined;
  const capabilities = [...listCoreCapabilities(), ...listDataCapabilities()];
  return toJson({
    platform: await chrome.runtime.getPlatformInfo(),
    manifest: chrome.runtime.getManifest(),
    extension: { id: chrome.runtime.id },
    relay: getState(),
    browserApis: {
      checkedActionCount: capabilities.length,
      unavailable: capabilities.filter(({ available }) => !available),
    },
    pageContentAvailability: "notProbed",
  });
};
