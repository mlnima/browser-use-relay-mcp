import type { CaptureReleaseMessage } from "./types.js";

const storageKey = "relay.capture.downloadResources";
let mutations = Promise.resolve();

const storedResources = async (): Promise<Record<string, string>> => {
  const stored = await chrome.storage.session.get(storageKey);
  return stored[storageKey] as Record<string, string> || {};
};

const mutate = <T>(operation: () => Promise<T>) => {
  const result = mutations.then(operation, operation);
  mutations = result.then(() => undefined, () => undefined);
  return result;
};

const releaseResource = async (downloadId: number) => {
  const resourceId = await mutate(async () => {
    const resources = await storedResources();
    const value = resources[String(downloadId)];
    if (!value) return undefined;
    delete resources[String(downloadId)];
    await chrome.storage.session.set({ [storageKey]: resources });
    return value;
  });
  if (!resourceId) return;
  const message: CaptureReleaseMessage = {
    type: "relay.offscreen.capture",
    operation: "release",
    resourceId,
  };
  await chrome.runtime.sendMessage(message).catch(() => undefined);
};

chrome.downloads.onChanged.addListener((delta) => {
  if (delta.state?.current === "complete" || delta.state?.current === "interrupted") {
    void releaseResource(delta.id);
  }
});

chrome.downloads.onErased.addListener((downloadId) => { void releaseResource(downloadId); });

export const trackCaptureDownload = async (downloadId: number, resourceId: string) => {
  await mutate(async () => {
    const resources = await storedResources();
    resources[String(downloadId)] = resourceId;
    await chrome.storage.session.set({ [storageKey]: resources });
  });
  const [item] = await chrome.downloads.search({ id: downloadId });
  if (item?.state === "complete" || item?.state === "interrupted") await releaseResource(downloadId);
  return item;
};

export const releaseCaptureResource = (resourceId: string) => chrome.runtime.sendMessage({
  type: "relay.offscreen.capture",
  operation: "release",
  resourceId,
} satisfies CaptureReleaseMessage).catch(() => undefined);
