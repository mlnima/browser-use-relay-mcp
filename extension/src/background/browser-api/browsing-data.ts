import type { BrowserApiHandler } from "./types.js";
import { completed } from "./json.js";
import { paramsOf } from "./parameters.js";

export const handleBrowsingDataAction: BrowserApiHandler = async (request) => {
  if (request.action !== "clearSiteData" && request.action !== "clearBrowsingData") return undefined;
  const params = paramsOf(request);
  const suppliedOptions = params.options && typeof params.options === "object" && !Array.isArray(params.options) ? params.options : undefined;
  const hasScope = Boolean(suppliedOptions && Object.keys(suppliedOptions).length) || ["since", "origins", "originTypes", "excludeOrigins"].some((key) => Object.prototype.hasOwnProperty.call(params, key));
  if (params.all !== true && !hasScope) throw new Error("Explicit removal options or params.all=true are required.");
  const options = (params.options || {
    ...(typeof params.since === "number" && { since: params.since }),
    ...(Array.isArray(params.origins) && { origins: params.origins }),
    ...(params.originTypes && { originTypes: params.originTypes }),
    ...(Array.isArray(params.excludeOrigins) && { excludeOrigins: params.excludeOrigins }),
  }) as chrome.browsingData.RemovalOptions;
  const data = (params.dataToRemove || params.dataTypes || {}) as chrome.browsingData.DataTypeSet;
  if (!Object.values(data).some((enabled) => enabled === true)) throw new Error("At least one browsing data type must be enabled.");
  await chrome.browsingData.remove(options, data);
  return completed();
};
