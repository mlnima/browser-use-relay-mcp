import type { JsonValue } from "../../../../src/types/json.js";
import { boundedHeaderRecord, boundedNetworkText } from "../browser-api/network-field-bounds";
import {
  CDP_REQUEST_STORE_MAX_BYTES, NETWORK_ERROR_MAX_BYTES, NETWORK_POST_DATA_MAX_BYTES,
  NETWORK_TEXT_MAX_BYTES, NETWORK_TOKEN_MAX_BYTES, NETWORK_URL_MAX_BYTES,
} from "../browser-api/network-observation-limits";
import { createNetworkRecordStore } from "../browser-api/network-record-store";
import { getState } from "../state/state-store";

export type CdpNetworkRecord = Record<string, JsonValue>;
const store = createNetworkRecordStore<CdpNetworkRecord>(CDP_REQUEST_STORE_MAX_BYTES);
const keyFor = (tabId: number, requestId: string) => `${tabId}:${requestId}`;

const update = (tabId: number, requestId: string, patch: CdpNetworkRecord) => {
  if (!getState().settings.enabled) return;
  const key = keyFor(tabId, requestId);
  store.put(key, { ...(store.get(key) || {}), ...patch, tabId, requestId, source: "cdp" });
};

chrome.debugger.onEvent.addListener((source, method, raw) => {
  if (source.tabId === undefined || !raw) return;
  const params = raw as Record<string, unknown>;
  const requestId = typeof params.requestId === "string" ? params.requestId : undefined;
  if (!requestId) return;
  if (method === "Network.requestWillBeSent") {
    const request = params.request as Record<string, unknown> | undefined;
    update(source.tabId, requestId, {
      url: boundedNetworkText(request?.url, NETWORK_URL_MAX_BYTES),
      method: boundedNetworkText(request?.method, NETWORK_TOKEN_MAX_BYTES),
      headers: boundedHeaderRecord(request?.headers),
      postData: typeof request?.postData === "string"
        ? boundedNetworkText(request.postData, NETWORK_POST_DATA_MAX_BYTES) : null,
      documentUrl: boundedNetworkText(params.documentURL, NETWORK_URL_MAX_BYTES),
      frameId: boundedNetworkText(params.frameId, NETWORK_TOKEN_MAX_BYTES),
      phase: "request",
    });
  }
  if (method === "Network.responseReceived") {
    const response = params.response as Record<string, unknown> | undefined;
    update(source.tabId, requestId, {
      url: boundedNetworkText(response?.url, NETWORK_URL_MAX_BYTES),
      statusCode: Number(response?.status || 0),
      statusText: boundedNetworkText(response?.statusText, NETWORK_TEXT_MAX_BYTES),
      mimeType: boundedNetworkText(response?.mimeType, NETWORK_TOKEN_MAX_BYTES),
      protocol: boundedNetworkText(response?.protocol, NETWORK_TOKEN_MAX_BYTES),
      headers: boundedHeaderRecord(response?.headers),
      phase: "response",
    });
  }
  if (method === "Network.loadingFinished") update(source.tabId, requestId, { phase: "completed", bodyAvailable: true, encodedBytes: Number(params.encodedDataLength || 0) });
  if (method === "Network.loadingFailed") update(source.tabId, requestId, {
    phase: "error", error: boundedNetworkText(params.errorText, NETWORK_ERROR_MAX_BYTES),
  });
});

export const clearCdpRequests = (tabId?: number) => {
  store.clear(tabId === undefined ? undefined : (_, record) => record.tabId === tabId);
};

chrome.debugger.onDetach.addListener((source) => source.tabId !== undefined && clearCdpRequests(source.tabId));

export const listCdpRequests = () => store.list();
export const cdpRequestStats = () => store.stats();
export const getCdpRequest = (requestId: string, tabId?: number) => tabId === undefined
  ? listCdpRequests().find((record) => record.requestId === requestId)
  : store.get(keyFor(tabId, requestId));
