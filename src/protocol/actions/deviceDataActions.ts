import type { ActionDefinition } from "../actionDefinition.js";

export const deviceDataActions = [
  { name: "copy", category: "clipboard", engines: ["browser", "native"], readOnly: false, description: "Copy the current selection." },
  { name: "cut", category: "clipboard", engines: ["browser", "native"], readOnly: false, description: "Cut the current selection." },
  { name: "paste", category: "clipboard", engines: ["browser", "native"], readOnly: false, description: "Paste clipboard content." },
  { name: "readClipboard", category: "clipboard", engines: ["browser", "native"], readOnly: true, description: "Read text, HTML, and supported binary clipboard content." },
  { name: "writeClipboard", category: "clipboard", engines: ["browser", "native"], readOnly: false, description: "Write text, HTML, and supported binary clipboard content." },
  { name: "startDownload", category: "downloads", engines: ["browser"], readOnly: false, description: "Start a download." },
  { name: "listDownloads", category: "downloads", engines: ["browser"], readOnly: true, description: "List downloads and states." },
  { name: "pauseDownload", category: "downloads", engines: ["browser"], readOnly: false, description: "Pause a download." },
  { name: "resumeDownload", category: "downloads", engines: ["browser"], readOnly: false, description: "Resume a download." },
  { name: "cancelDownload", category: "downloads", engines: ["browser"], readOnly: false, description: "Cancel a download." },
  { name: "removeDownloadedFile", category: "downloads", engines: ["browser"], readOnly: false, description: "Remove a downloaded file." },
  { name: "eraseDownload", category: "downloads", engines: ["browser"], readOnly: false, description: "Erase a download record." },
  { name: "openDownload", category: "downloads", engines: ["browser", "native"], readOnly: false, description: "Resolve a path or completed download ID and open the file through the native engine without chrome.downloads.open." },
  { name: "revealDownload", category: "downloads", engines: ["browser", "native"], readOnly: false, description: "Resolve a path or completed download ID and reveal the file through the native engine." },
  { name: "captureVisibleTab", category: "screenshot", engines: ["browser"], readOnly: false, description: "Capture the requested tab and return a data URL with pixel dimensions; an inactive tab may be activated temporarily." },
  { name: "captureViewport", category: "screenshot", engines: ["browser"], readOnly: false, description: "Capture the requested viewport and return a data URL with pixel dimensions; an inactive tab may be activated temporarily." },
  { name: "captureElement", category: "screenshot", engines: ["browser"], readOnly: false, description: "Capture a target element and return a data URL with pixel dimensions and page clip; capture may activate its tab or attach the debugger." },
  { name: "captureFullPage", category: "screenshot", engines: ["browser"], readOnly: false, description: "Assemble full-document CDP tiles and return a data URL with dimensions and tile metadata; capture attaches the debugger." },
  { name: "startTabCapture", category: "capture", engines: ["browser"], readOnly: false, description: "Start permitted tab media capture." },
  { name: "stopTabCapture", category: "capture", engines: ["browser"], readOnly: false, description: "Stop tab media capture." },
] satisfies readonly ActionDefinition[];
