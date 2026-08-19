import type { ActionDefinition } from "../actionDefinition.js";

const all = ["browser", "dom", "native"] as const;

export const compoundActions = [
  { name: "clickElement", category: "compound", engines: all, readOnly: false, description: "Resolve, revalidate, scroll, and click a target." },
  { name: "fillField", category: "compound", engines: all, readOnly: false, description: "Resolve, focus, clear, and type into a field." },
  { name: "chooseOption", category: "compound", engines: ["dom", "native"], readOnly: false, description: "Resolve and choose an option." },
  { name: "uploadFile", category: "compound", engines: ["native"], readOnly: false, description: "Transfer an MCP-client file to the browser device." },
  { name: "downloadFile", category: "compound", engines: ["native"], readOnly: true, description: "Read a browser-device file in verified chunks." },
  { name: "dragElement", category: "compound", engines: ["browser", "native"], readOnly: false, description: "Resolve and drag an element." },
  { name: "extractTable", category: "compound", engines: ["dom"], readOnly: true, description: "Extract structured table data." },
  { name: "extractLinks", category: "compound", engines: ["dom"], readOnly: true, description: "Extract visible links." },
  { name: "findAndClick", category: "compound", engines: all, readOnly: false, description: "Find, revalidate, and click a target." },
  { name: "findAndFill", category: "compound", engines: all, readOnly: false, description: "Find, revalidate, and fill a field." },
  { name: "scrollUntilFound", category: "compound", engines: ["dom"], readOnly: false, description: "Scroll until a target is found." },
  { name: "clickUntilGone", category: "compound", engines: ["dom"], readOnly: false, description: "Click and wait until the target disappears." },
  { name: "submitAndWait", category: "compound", engines: ["browser"], readOnly: false, description: "Submit and wait for navigation or page stability." },
  { name: "openAndSwitchToNewTab", category: "compound", engines: ["browser"], readOnly: false, description: "Open and activate a new tab." },
  { name: "downloadAndWait", category: "compound", engines: ["browser"], readOnly: false, description: "Start and wait for a completed download." },
  { name: "uploadAndWait", category: "compound", engines: ["browser"], readOnly: false, description: "Upload browser-device paths and wait for completion signals." },
  { name: "retryAction", category: "compound", engines: ["browser"], readOnly: false, description: "Retry a revalidated action with bounded backoff." },
  { name: "nativeFileChooser", category: "nativeUI", engines: ["native"], readOnly: false, description: "Control an OS file chooser." },
  { name: "nativeSaveDialog", category: "nativeUI", engines: ["native"], readOnly: false, description: "Control an OS save dialog." },
  { name: "nativePrintDialog", category: "nativeUI", engines: ["native"], readOnly: false, description: "Control an OS print dialog." },
  { name: "nativePermissionPrompt", category: "nativeUI", engines: ["native"], readOnly: false, description: "Control a browser or OS permission prompt." },
  { name: "nativeBrowserUI", category: "nativeUI", engines: ["native"], readOnly: false, description: "Control visible browser chrome with OS input." },
] satisfies readonly ActionDefinition[];
