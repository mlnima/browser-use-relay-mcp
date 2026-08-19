import type { CaptureStopResult } from "../../background/browser-api/tab-capture/types.js";

export type CaptureSession = {
  captureId: string;
  tabId: number;
  stream: MediaStream;
  recorder: MediaRecorder;
  chunks: Blob[];
  bytes: number;
  startedAt: number;
  stopped: Promise<void>;
  resolveStopped: () => void;
  audioContext?: AudioContext;
  audioSource?: MediaStreamAudioSourceNode;
  error?: Error;
  stopRequested?: boolean;
  finishing?: Promise<CaptureStopResult>;
  releasing?: Promise<void>;
  durationTimer?: ReturnType<typeof setTimeout>;
};

export type CaptureResource = {
  blobUrl: string;
  size: number;
  createdAt: number;
  lease: ReturnType<typeof setTimeout>;
};
export type CaptureFailure = {
  message: string;
  createdAt: number;
  lease: ReturnType<typeof setTimeout>;
};

export const captureSessions = new Map<string, CaptureSession>();
export const startingCaptures = new Set<string>();
export const captureStartControllers = new Map<string, AbortController>();
export const captureResources = new Map<string, CaptureResource>();
export const captureFailures = new Map<string, CaptureFailure>();
