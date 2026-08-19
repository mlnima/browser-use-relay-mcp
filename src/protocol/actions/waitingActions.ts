import type { ActionDefinition } from "../actionDefinition.js";

const dom = ["dom"] as const;
const browser = ["browser"] as const;

export const waitingActions = [
  { name: "sleep", category: "wait", engines: dom, readOnly: true, description: "Wait for a duration with cancellation." },
  { name: "waitForElement", category: "wait", engines: dom, readOnly: true, description: "Wait for a target to exist." },
  { name: "waitForElementRemoved", category: "wait", engines: dom, readOnly: true, description: "Wait for a target to be removed." },
  { name: "waitVisible", category: "wait", engines: dom, readOnly: true, description: "Wait for visibility." },
  { name: "waitHidden", category: "wait", engines: dom, readOnly: true, description: "Wait for hidden state." },
  { name: "waitEnabled", category: "wait", engines: dom, readOnly: true, description: "Wait for enabled state." },
  { name: "waitDisabled", category: "wait", engines: dom, readOnly: true, description: "Wait for disabled state." },
  { name: "waitStable", category: "wait", engines: dom, readOnly: true, description: "Wait for stable layout and DOM revision." },
  { name: "waitText", category: "wait", engines: dom, readOnly: true, description: "Wait for target text." },
  { name: "waitValue", category: "wait", engines: dom, readOnly: true, description: "Wait for a control value." },
  { name: "waitAttribute", category: "wait", engines: dom, readOnly: true, description: "Wait for an attribute value." },
  { name: "waitURL", category: "wait", engines: browser, readOnly: true, description: "Wait for a matching URL." },
  { name: "waitNavigation", category: "wait", engines: browser, readOnly: true, description: "Wait for a navigation lifecycle event." },
  { name: "waitFrame", category: "wait", engines: browser, readOnly: true, description: "Wait for a matching frame." },
  { name: "waitDOMMutation", category: "wait", engines: dom, readOnly: true, description: "Wait for a DOM revision change." },
  { name: "waitRequest", category: "wait", engines: browser, readOnly: true, description: "Wait for a matching network request." },
  { name: "waitResponse", category: "wait", engines: browser, readOnly: true, description: "Wait for a matching network response." },
  { name: "waitDownload", category: "wait", engines: browser, readOnly: true, description: "Wait for a download state." },
] satisfies readonly ActionDefinition[];
