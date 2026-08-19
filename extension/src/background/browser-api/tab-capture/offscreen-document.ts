import { assertActionCapability } from "../capability.js";
import { CAPTURE_DOCUMENT_CLOSE_TIMEOUT_MS, CAPTURE_START_TIMEOUT_MS } from "../../../offscreen/capture/limits.js";

type OffscreenApi = {
  createDocument?: (options: {
    url: string;
    reasons: string[];
    justification: string;
  }) => Promise<void>;
  closeDocument?: () => Promise<void>;
};

type RuntimeContextsApi = {
  getContexts?: (filter: {
    contextTypes: string[];
    documentUrls: string[];
  }) => Promise<unknown[]>;
};

const documentUrl = chrome.runtime.getURL("offscreen.html");
let creating: Promise<void> | undefined;
let documentGeneration = 0;
const withDeadline = <T>(pending: Promise<T>, timeoutMs: number, message: string) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([pending, deadline]).finally(() => { if (timer) clearTimeout(timer); });
};

export const hasCaptureDocument = async () => {
  const getContexts = (chrome.runtime as unknown as RuntimeContextsApi).getContexts;
  assertActionCapability(["chrome.runtime.getContexts", typeof getContexts === "function"]);
  return Boolean((await withDeadline(getContexts!.call(chrome.runtime, {
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [documentUrl],
  }), CAPTURE_START_TIMEOUT_MS, "TAB_CAPTURE_DOCUMENT_TIMEOUT: Offscreen document lookup timed out.")).length);
};

export const ensureCaptureDocument = async (signal?: AbortSignal) => {
  signal?.throwIfAborted();
  documentGeneration += 1;
  if (creating) await withDeadline(
    creating, CAPTURE_START_TIMEOUT_MS, "TAB_CAPTURE_DOCUMENT_TIMEOUT: Offscreen document creation timed out.",
  );
  else if (!await hasCaptureDocument()) {
    signal?.throwIfAborted();
    const createDocument = (chrome.offscreen as unknown as OffscreenApi | undefined)?.createDocument;
    assertActionCapability(["chrome.offscreen.createDocument", typeof createDocument === "function"]);
    creating ||= createDocument!.call(chrome.offscreen, {
      url: "offscreen.html",
      reasons: ["USER_MEDIA", "AUDIO_PLAYBACK", "BLOBS", "CLIPBOARD"],
      justification: "Record tab media, retain recording blobs, and preserve clipboard access.",
    }).finally(() => { creating = undefined; });
    await withDeadline(
      creating, CAPTURE_START_TIMEOUT_MS, "TAB_CAPTURE_DOCUMENT_TIMEOUT: Offscreen document creation timed out.",
    );
  }
  signal?.throwIfAborted();
};

export const closeCaptureDocument = async () => {
  const closingGeneration = documentGeneration;
  const pendingCreation = creating;
  if (pendingCreation) {
    try {
      await withDeadline(pendingCreation, CAPTURE_DOCUMENT_CLOSE_TIMEOUT_MS, "Offscreen document creation did not settle.");
    } catch {
      void pendingCreation.finally(() => closingGeneration === documentGeneration
        ? closeCaptureDocument() : undefined).catch(() => undefined);
      return;
    }
  }
  const getContexts = (chrome.runtime as unknown as RuntimeContextsApi).getContexts;
  const closeDocument = (chrome.offscreen as unknown as OffscreenApi | undefined)?.closeDocument;
  if (typeof getContexts !== "function" || typeof closeDocument !== "function") return;
  const lookup = getContexts.call(chrome.runtime, {
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [documentUrl],
  });
  let contexts: unknown[];
  try {
    contexts = await withDeadline(lookup, CAPTURE_DOCUMENT_CLOSE_TIMEOUT_MS, "Offscreen document lookup timed out.");
  } catch {
    void lookup.then((late) => late.length && closingGeneration === documentGeneration
      ? closeDocument.call(chrome.offscreen) : undefined).catch(() => undefined);
    return;
  }
  if (contexts.length && closingGeneration === documentGeneration) await withDeadline(
    closeDocument.call(chrome.offscreen), CAPTURE_DOCUMENT_CLOSE_TIMEOUT_MS, "Offscreen document close timed out.",
  );
};
