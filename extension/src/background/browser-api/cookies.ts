import type { BrowserApiHandler } from "./types.js";
import { toJson } from "./json.js";
import { paramsOf } from "./parameters.js";

export const handleCookieAction: BrowserApiHandler = async (request) => {
  const params = paramsOf(request);
  const details = params.details || params;
  switch (request.action) {
    case "listCookies":
      return toJson(await chrome.cookies.getAll(details as unknown as chrome.cookies.GetAllDetails));
    case "getCookie":
      return toJson(await chrome.cookies.get(details as unknown as chrome.cookies.CookieDetails));
    case "setCookie":
      return toJson(await chrome.cookies.set(details as unknown as chrome.cookies.SetDetails));
    case "deleteCookie":
      return toJson(await chrome.cookies.remove(details as unknown as chrome.cookies.CookieDetails));
    default:
      return undefined;
  }
};
