import type { JsonValue } from "../../../../src/types/json.js";
import type { BrowserApiHandler } from "./types.js";
import { paramsOf } from "./parameters.js";
import { toJson } from "./json.js";
import {
  listObservedRequests,
  subscribeObservedRequests,
  type ObservedRequest,
} from "./request-observer.js";
import { abortReason, listenForAbort } from "./wait-signal.js";

const matches = (
  record: ObservedRequest,
  params: Record<string, JsonValue>,
  response: boolean,
  pattern?: RegExp,
) => {
  const url = String(record.url || "");
  const responseSeen = typeof record.statusCode === "number" || record.phase === "error";
  return (!response || responseSeen)
    && (typeof params.requestId !== "string" || record.requestId === params.requestId)
    && (typeof params.tabId !== "number" || record.tabId === params.tabId)
    && (typeof params.method !== "string" || record.method === params.method)
    && (typeof params.type !== "string" || record.type === params.type)
    && (typeof params.statusCode !== "number" || record.statusCode === params.statusCode)
    && (typeof params.url !== "string" || url === params.url)
    && (typeof params.urlContains !== "string" || url.includes(params.urlContains))
    && (!pattern || pattern.test(url));
};

export const handleNetworkWaitAction: BrowserApiHandler = async (request, signal) => {
  if (request.action !== "waitRequest" && request.action !== "waitResponse") return undefined;
  const rawParams = paramsOf(request);
  const params = typeof request.target?.tabId === "number"
    ? { ...rawParams, tabId: request.target.tabId }
    : rawParams;
  const response = request.action === "waitResponse";
  const pattern = typeof params.urlPattern === "string" ? new RegExp(params.urlPattern) : undefined;
  return new Promise<JsonValue>((resolve, reject) => {
    let settled = false;
    let removeAbort: () => void = () => undefined;
    let unsubscribe: () => void = () => undefined;
    const clean = () => {
      unsubscribe();
      clearTimeout(timer);
      removeAbort();
    };
    const finish = (record: ObservedRequest) => {
      if (settled) return;
      settled = true;
      clean();
      resolve(toJson(record));
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      clean();
      reject(error);
    };
    unsubscribe = subscribeObservedRequests((record) => {
      if (matches(record, params, response, pattern)) finish(record);
    });
    const timeout = request.timeoutMs ?? 30_000;
    const timer = setTimeout(() => fail(new Error(`Timed out waiting for a network ${response ? "response" : "request"}.`)), timeout);
    removeAbort = listenForAbort(signal, () => fail(abortReason(signal)));
    const existing = listObservedRequests().findLast((record) => matches(record, params, response, pattern));
    if (existing) finish(existing);
  });
};
