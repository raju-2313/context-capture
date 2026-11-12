import { capturePipeline } from "../core/capture/pipeline";

export function registerContextMenu(): void {
  chrome.contextMenus.create({
    id: "capture-selection",
    title: "Capture selection",
    contexts: ["selection"],
  });

  chrome.contextMenus.create({
    id: "capture-link",
    title: "Capture link",
    contexts: ["link"],
  });

  chrome.contextMenus.create({
    id: "capture-page",
    title: "Capture page",
    contexts: ["page"],
  });

  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    try {
      if (info.menuItemId === "capture-selection" && info.selectionText) {
        await capturePipeline.captureText({
          text: info.selectionText,
          tabId: tab!.id!,
          windowId: tab!.windowId!,
        });
      } else if (info.menuItemId === "capture-link" && info.linkUrl) {
        await capturePipeline.captureLink({
          url: info.linkUrl,
          title: (((info as any).linkText ?? "") as string),
          tabId: (((tab as any)?.id) ?? null),
          windowId: (tab as any)?.windowId ?? null,
        });
      } else if (info.menuItemId === "capture-page" && tab) {
        await capturePipeline.captureLink({
          url: tab.url ?? "",
          title: tab.title ?? "",
          tabId: tab.id ?? 0,
          windowId: tab.windowId,
        });
      }
    } catch (err) {
      console.error("Context menu capture error", err);
    }
  });
}

registerContextMenu();