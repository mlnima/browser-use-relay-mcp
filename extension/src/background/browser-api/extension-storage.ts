import type { JsonValue } from "../../../../src/types/json.js";
import type { BrowserApiHandler } from "./types.js";
import { apiCapability, assertActionCapability } from "./capability.js";
import { completed } from "./json.js";
import { paramsOf } from "./parameters.js";
import { SETTINGS_STORAGE_KEY } from "../../shared/defaults";
import { extensionStorageKeys, readExtensionStorage } from "./read-extension-storage.js";

const storageArea = (name: JsonValue | undefined): [string, chrome.storage.StorageArea] => {
  if (name !== undefined && !["local", "sync", "session", "managed"].includes(String(name))) throw new Error("Extension storage area must be local, sync, session, or managed.");
  const areaName = name === undefined ? "local" : String(name);
  const area = (chrome.storage as unknown as Record<string, chrome.storage.StorageArea | undefined>)?.[areaName];
  assertActionCapability([`chrome.storage.${areaName}`, Boolean(area)]);
  return [areaName, area!];
};

const includesSettings = (value: JsonValue | undefined) => value === SETTINGS_STORAGE_KEY
  || Array.isArray(value) && value.includes(SETTINGS_STORAGE_KEY);

export const handleExtensionStorageAction: BrowserApiHandler = async (request) => {
  if (request.action !== "readExtensionStorage" && request.action !== "writeExtensionStorage") return undefined;
  const params = paramsOf(request);
  const [areaName, area] = storageArea(params.area);
  if (request.action === "readExtensionStorage") {
    assertActionCapability(apiCapability(area, "get", `chrome.storage.${areaName}.get`));
    return readExtensionStorage(area, params);
  }
  if (areaName === "managed") throw new Error("Managed extension storage is read-only.");
  const method = params.clear === true ? "clear" : params.removeKeys ? "remove" : "set";
  assertActionCapability(apiCapability(area, method, `chrome.storage.${areaName}.${method}`));
  if (areaName === "local" && method === "remove" && includesSettings(params.removeKeys)) throw new Error(`${SETTINGS_STORAGE_KEY} is managed by extension settings.`);
  if (method === "clear" && areaName === "local") {
    const keys = (await extensionStorageKeys(area)).filter((key) => key !== SETTINGS_STORAGE_KEY);
    if (keys.length) await area.remove(keys);
  } else if (method === "clear") await area.clear();
  else if (method === "remove") await area.remove(params.removeKeys as string | string[]);
  else {
    const items = params.items || (typeof params.key === "string" ? { [params.key]: params.value ?? null } : {});
    if (areaName === "local" && Object.prototype.hasOwnProperty.call(items, SETTINGS_STORAGE_KEY)) throw new Error(`${SETTINGS_STORAGE_KEY} is managed by extension settings.`);
    await area.set(items as Record<string, unknown>);
  }
  return completed();
};
