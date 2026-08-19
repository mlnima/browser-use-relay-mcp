import type { TabIdSelection } from "./parameters.js";
import { tabIdArray } from "./parameters.js";
import { completed } from "./json.js";

let closeQueue: Promise<void> = Promise.resolve();

const queued = <Value>(work: () => Promise<Value>) => {
  const operation = closeQueue.then(work);
  closeQueue = operation.then(() => undefined, () => undefined);
  return operation;
};

const closeSelected = async (selection: TabIdSelection) => {
  const ids = [...tabIdArray(selection)];
  if (ids.length === 0) throw new Error("At least one tab ID is required.");
  if (ids.some((id) => !Number.isSafeInteger(id) || id < 0)) throw new Error("Every tab ID must be a nonnegative integer.");
  const requested = new Set(ids);
  if (requested.size !== ids.length) throw new Error("Requested tab IDs must not contain duplicates.");
  const tabs = await chrome.tabs.query({});
  const open = new Set(tabs.flatMap((tab) => typeof tab.id === "number" ? [tab.id] : []));
  if (ids.some((id) => !open.has(id))) throw new Error("Every requested tab must be open.");
  if (open.size - requested.size < 1) throw new Error("The final browser tab cannot be closed.");
  await chrome.tabs.remove([...requested]);
  return completed();
};

export const closeTabsSafely = (selection: TabIdSelection) => {
  return queued(() => closeSelected(selection));
};

export const closeWindowSafely = (windowId: number) => queued(async () => {
  const tabs = await chrome.tabs.query({});
  const closing = tabs.filter((tab) => tab.windowId === windowId);
  if (closing.length === 0) throw new Error("The requested browser window is not open.");
  if (tabs.length - closing.length < 1) throw new Error("The final browser tab cannot be closed.");
  await chrome.windows.remove(windowId);
  return completed();
});
