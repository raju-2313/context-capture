chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "CAPTURE_SCREENSHOT_OFFSCREEN") {
    // Offscreen handles crop/thumbnail
    sendResponse({ success: true });
    return true;
  }
  return false;
});
