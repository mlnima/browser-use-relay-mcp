export const resolveTabId = async (requested?: number) => {
  if (requested !== undefined) return requested;
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab?.id === undefined) throw new Error("No active controllable tab is available.");
  return tab.id;
};
