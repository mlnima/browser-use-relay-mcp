import type { ActionRequest } from "../../../../src/types/action.js";
import type { JsonValue } from "../../../../src/types/json.js";
import { paramsOf } from "./parameters.js";
import { toJson } from "./json.js";
import { readFetchResponse } from "./fetch-response.js";

const requestBody = (value: JsonValue | undefined): BodyInit | undefined => {
  if (value === undefined || value === null) return undefined;
  return typeof value === "string" ? value : JSON.stringify(value);
};

export const executeExtensionFetch = async (request: ActionRequest, signal?: AbortSignal) => {
  const params = paramsOf(request);
  const timeoutSignal = request.timeoutMs !== undefined ? AbortSignal.timeout(request.timeoutMs) : undefined;
  const requestSignal = signal && timeoutSignal ? AbortSignal.any([signal, timeoutSignal]) : signal || timeoutSignal;
  const response = await globalThis.fetch(params.url as string, {
    method: params.method as string | undefined,
    headers: params.headers as Record<string, string> | undefined,
    body: requestBody(params.body),
    credentials: params.credentials as RequestCredentials | undefined,
    cache: params.cache as RequestCache | undefined,
    redirect: params.redirect as RequestRedirect | undefined,
    referrer: params.referrer as string | undefined,
    referrerPolicy: params.referrerPolicy as ReferrerPolicy | undefined,
    integrity: params.integrity as string | undefined,
    keepalive: params.keepalive as boolean | undefined,
    mode: params.mode as RequestMode | undefined,
    signal: requestSignal,
  });
  const body = await readFetchResponse(response, params.responseType, params.maxResponseBytes, requestSignal);
  return toJson({
    url: response.url,
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
    redirected: response.redirected,
    type: response.type,
    headers: Object.fromEntries(response.headers.entries()),
    body,
  });
};
