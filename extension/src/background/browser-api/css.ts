import type { BrowserApiHandler } from "./types.js";
import { resolveTabId } from "./parameters.js";

type CssInsertion = {
  target: chrome.scripting.InjectionTarget;
  css: string;
  origin: "AUTHOR" | "USER";
};
const insertions: CssInsertion[] = [];
let operations = Promise.resolve();
const serialized = <Value>(operation: () => Promise<Value>): Promise<Value> => {
  const result = operations.then(operation);
  operations = result.then(() => undefined, () => undefined);
  return result;
};
const sameValues = (left?: readonly (number | string)[], right?: readonly (number | string)[]) =>
  left?.length === right?.length && (left || []).every((value, index) => value === right?.[index]);
const sameTarget = (left: chrome.scripting.InjectionTarget, right: chrome.scripting.InjectionTarget) =>
  left.tabId === right.tabId && left.allFrames === right.allFrames &&
  sameValues(left.frameIds, right.frameIds) && sameValues(left.documentIds, right.documentIds);
const sameInsertion = (left: CssInsertion, right: CssInsertion) =>
  left.css === right.css && left.origin === right.origin && sameTarget(left.target, right.target);

const injectionTarget = async (request: Parameters<BrowserApiHandler>[0]) => {
  const tabId = await resolveTabId(request);
  if (request.target?.documentId) return { tabId, documentIds: [request.target.documentId] } as chrome.scripting.InjectionTarget;
  if (request.target?.frameId !== undefined) return { tabId, frameIds: [request.target.frameId] } as chrome.scripting.InjectionTarget;
  return request.params?.allFrames ? { tabId, allFrames: true } as chrome.scripting.InjectionTarget : { tabId };
};

export const handleCssAction: BrowserApiHandler = async (request) => {
  if (request.action !== "injectCSS" && request.action !== "removeInjectedCSS") return undefined;
  const css = request.params?.css;
  if (typeof css !== "string" || !css) throw new Error("A non-empty params.css value is required.");
  const options: CssInsertion = {
    target: await injectionTarget(request),
    css,
    origin: request.params?.origin === "USER" ? "USER" : "AUTHOR",
  };
  return serialized(async () => {
    if (request.action === "injectCSS") {
      await chrome.scripting.insertCSS(options);
      insertions.push(options);
    } else {
      await chrome.scripting.removeCSS(options);
      for (let index = insertions.length - 1; index >= 0; index -= 1) {
        if (sameInsertion(insertions[index], options)) insertions.splice(index, 1);
      }
    }
    return true;
  });
};

export const clearInjectedCss = () => serialized(async () => {
  const pending = insertions.splice(0);
  await Promise.allSettled(pending.map((options) => Promise.resolve().then(() => chrome.scripting.removeCSS(options))));
});
