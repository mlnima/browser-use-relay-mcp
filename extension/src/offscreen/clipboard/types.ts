export type ClipboardValue = { text?: string; base64?: string };
export type ClipboardWriteItem = { data: Record<string, ClipboardValue> };
export type ClipboardRequest = {
  type: "relay.offscreen.clipboard";
  operation: "read" | "write";
  formats?: string[];
  text?: string;
  html?: string;
  items?: ClipboardWriteItem[];
};
