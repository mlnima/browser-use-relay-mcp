import type { JsonValue } from "./json.js";

export type ElementBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CatalogElement = {
  id: string;
  tag: string;
  role?: string;
  name?: string;
  text?: string;
  value?: string;
  href?: string;
  placeholder?: string;
  bounds?: ElementBounds;
  visible?: false;
  enabled?: false;
  editable?: true;
  readonly?: true;
  checked?: boolean;
  selected?: boolean;
  selectedValues?: string[];
  attributes?: Record<string, string>;
};

export type SnapshotCatalogMetadata = {
  byteLimit: number;
  encodedBytes: number;
  returnedElementCount: number;
  scannedElementCount: number;
  scannedElementLimit: number;
  stringTruncationCount: number;
  omittedAttributeCount: number;
  omittedSelectedValueCount: number;
  omittedElementCount?: number;
  unstable?: boolean;
  truncated: boolean;
  truncationReason?: "maxElements" | "maxBytes" | "maxScannedElements" | "maxMcpResultBytes";
};

export type FrameSnapshot = {
  frameId: number;
  documentId?: string;
  url: string;
  title: string;
  revision: number;
  elements: CatalogElement[];
  catalog: SnapshotCatalogMetadata;
};

export type SnapshotFailure = {
  frameId?: number;
  documentId?: string | null;
  url?: string;
  error: { code: string; message: string };
};

export type BrowserSnapshot = {
  capturedAt: string;
  tabId: number;
  url: string;
  title: string;
  frames: Array<FrameSnapshot | SnapshotFailure>;
  page: Record<string, JsonValue> | SnapshotFailure;
  catalog: SnapshotCatalogMetadata & { requestedElementLimit: number };
  outputLimits: { stringCharacterLimit: number; stringTruncationCount: number };
  screenshot?: string;
};
