import type { ActionRequest, NativePage } from "../../../../src/types/action.js";
import type { JsonValue } from "../../../../src/types/json.js";
import { nativePageActions, scrollActions } from "../../../../src/native/nativeActionNames.js";
import { resolveTabId } from "../actions/tab";
import { resolvePoint } from "../debugger/resolve-point";

const observed = new Map<number, { fingerprint: string; id: string; windowId: number }>();
chrome.windows.onFocusChanged.addListener((id) => {
  for (const [tabId, page] of observed) if (page.windowId !== id) observed.delete(tabId);
});
chrome.windows.onBoundsChanged.addListener((window) => {
  for (const [tabId, page] of observed) if (page.windowId === window.id) observed.delete(tabId);
});
chrome.tabs.onActivated.addListener((info) => {
  for (const [tabId, page] of observed) if (page.windowId === info.windowId && tabId !== info.tabId) observed.delete(tabId);
});
chrome.tabs.onZoomChange.addListener(({ tabId }) => observed.delete(tabId));
chrome.tabs.onUpdated.addListener((tabId, change) => { if (change.url || change.status === "loading") observed.delete(tabId); });
chrome.tabs.onRemoved.addListener((tabId) => observed.delete(tabId));
const fingerprint = (page: NativePage, window: chrome.windows.Window) => JSON.stringify([
  page.url, page.width, page.height, page.zoom, page.windowId, window.left, window.top, window.width, window.height, window.state,
]);
const readPage = async (tabId: number) => {
  const tab = await chrome.tabs.get(tabId);
  const [window, zoom, measurements] = await Promise.all([
    chrome.windows.get(tab.windowId), chrome.tabs.getZoom(tabId),
    chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, world: "ISOLATED",
      func: () => ({ title: document.title, url: location.href, width: innerWidth, height: innerHeight,
        focused: document.hasFocus() && document.visibilityState === "visible" }) }),
  ]);
  const value = measurements[0]?.result;
  if (!value) throw new Error("The webpage cannot be measured for native input.");
  const page: NativePage = { ...value, tabId, windowId: tab.windowId, zoom, observation: observed.get(tabId)?.id || "",
    focused: value.focused && tab.active && window.focused && window.state !== "minimized" };
  return { page, window, fingerprint: fingerprint(page, window) };
};
export const withNativePageObservation = async <T>(tabId: number, read: () => Promise<T>) => {
  const before = await readPage(tabId).catch(() => undefined);
  const result = await read();
  const after = await readPage(tabId).catch(() => undefined);
  observed.delete(tabId);
  if (before && after && before.fingerprint === after.fingerprint)
    observed.set(tabId, { fingerprint: after.fingerprint, id: crypto.randomUUID(), windowId: after.page.windowId });
  return result;
};
export const prepareNativePage = async (request: ActionRequest, signal: AbortSignal) => {
  if (!nativePageActions.has(request.action)) return { request, page: undefined };
  const tabId = await resolveTabId(request.target?.tabId);
  const state = await readPage(tabId);
  signal.throwIfAborted();
  if (!state.page.focused) throw new Error("The requested webpage has lost focus. Take a fresh snapshot before native input.");
  if (observed.get(tabId)?.fingerprint !== state.fingerprint) throw new Error("The webpage moved, resized, zoomed, or navigated. Take a fresh snapshot before native input.");
  const target = request.target;
  const parameterPoint = !scrollActions.has(request.action);
  const coordinates = { ...target, x: target?.x ?? (parameterPoint ? request.params?.x as number | undefined : undefined),
    y: target?.y ?? (parameterPoint ? request.params?.y as number | undefined : undefined) };
  const webTarget = target?.elementId !== undefined || target?.locator !== undefined ||
    coordinates.x !== undefined && (target?.frameId !== undefined || target?.documentId !== undefined);
  const point = webTarget ? await resolvePoint({ ...request, target: coordinates }, tabId, signal)
    : coordinates.x !== undefined || coordinates.y !== undefined ? { x: coordinates.x!, y: coordinates.y! } : undefined;
  const params = { ...request.params };
  if (point && parameterPoint) { delete params.x; delete params.y; }
  for (const prefix of ["from", "to"] as const) {
    if (params[`${prefix}X`] === undefined && params[`${prefix}Y`] === undefined) continue;
    const point = await resolvePoint({ ...request, target: { tabId, frameId: target?.frameId, documentId: target?.documentId,
      x: params[`${prefix}X`] as number, y: params[`${prefix}Y`] as number } }, tabId, signal);
    params[`${prefix}X`] = point.x; params[`${prefix}Y`] = point.y;
  }
  const destination = params.destination;
  if (destination && typeof destination === "object" && !Array.isArray(destination)) {
    const destinationTarget = destination as ActionRequest["target"];
    if (destinationTarget?.tabId !== undefined && destinationTarget.tabId !== tabId) throw new Error("Native drags must stay inside one webpage.");
    params.destination = await resolvePoint({ ...request, target: { ...destinationTarget, tabId } }, tabId, signal) as unknown as JsonValue;
  }
  const latest = await readPage(tabId);
  if (!latest.page.focused || latest.fingerprint !== state.fingerprint) throw new Error("The webpage changed while resolving the native target. Take a fresh snapshot.");
  const nextRequest = { ...request, params };
  delete nextRequest.target;
  return { request: { ...nextRequest, ...(point ? { target: point } : {}) }, page: state.page };
};

export const watchNativePage = (page: NativePage, changed: () => void) => {
  let checking = false;
  const check = async () => {
    if (checking) return;
    checking = true;
    try {
      const state = await readPage(page.tabId);
      if (!state.page.focused || observed.get(page.tabId)?.id !== page.observation || observed.get(page.tabId)?.fingerprint !== state.fingerprint) changed();
    } catch { changed(); }
    finally { checking = false; }
  };
  const bounds = (window: chrome.windows.Window) => window.id === page.windowId && void check();
  const focused = (id: number) => id !== page.windowId && changed();
  const activated = (info: { windowId: number; tabId: number }) => info.windowId === page.windowId && info.tabId !== page.tabId && changed();
  const timer = setInterval(() => void check(), 50);
  chrome.windows.onBoundsChanged.addListener(bounds);
  chrome.windows.onFocusChanged.addListener(focused);
  chrome.tabs.onActivated.addListener(activated);
  return () => {
    clearInterval(timer);
    chrome.windows.onBoundsChanged.removeListener(bounds);
    chrome.windows.onFocusChanged.removeListener(focused);
    chrome.tabs.onActivated.removeListener(activated);
  };
};
