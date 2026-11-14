export async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  try {
    const [lastFocusedTab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    if (lastFocusedTab?.id != null) return lastFocusedTab;
  } catch (error) {
    console.warn("Failed to query the last focused tab", error);
  }

  try {
    const [currentWindowTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    return currentWindowTab?.id != null ? currentWindowTab : undefined;
  } catch (error) {
    console.warn("Failed to query the current window tab", error);
    return undefined;
  }
}
