import { contextLifecycle } from "../core/context/lifecycle";
import { capturePipeline } from "../core/capture/pipeline";
import { messageRouter } from "./messageRouter";
import { logger } from "../shared/logger";
import { settingsStore, ensureDeviceId } from "../data/settings";
import { initMeta } from "../data/db";

chrome.runtime.onInstalled.addListener(async (details) => {
  logger.info("Extension installed", details.reason);
  try {
    await chrome.sidePanel.setOptions({ path: "sidepanel/index.html", enabled: true });
  } catch (e) {
    logger.warn("sidePanel API not available", String(e));
  }
  if (details.reason === "install") {
    const deviceId = crypto.randomUUID();
    const installId = crypto.randomUUID();
    await initMeta(deviceId, installId);
    await settingsStore.resetToDefaults();
    await ensureDeviceId();
  }
});

chrome.runtime.onStartup.addListener(async () => {
  logger.info("Browser startup - reconciling bindings");
  await contextLifecycle.reconcileOnStartup();
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  logger.info(`Tab closed: ${tabId}`);
  await contextLifecycle.onTabClosed(tabId);
});

chrome.tabs.onActivated.addListener(async (info) => {
  await contextLifecycle.onTabActivated(info.tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab) {
    const binding = await contextLifecycle.getContextForTab(tabId);
    if (binding && tab.url && tab.url.startsWith("http")) {
      // last_url updated at capture time; skip here to avoid extra DB writes
    }
  }
});

chrome.runtime.onMessage.addListener((message: any, _sender: chrome.runtime.MessageSender, sendResponse: (resp: any) => void) => {
  const handled = messageRouter.route(message, _sender, sendResponse);
  return handled;
});

chrome.commands.onCommand.addListener(async (command) => {
  logger.info("Command invoked", command);
  try {
    switch (command) {
      case "capture-text":
        await messageRouter.handleShortcut("capture-text");
        break;
      case "capture-screenshot":
        await messageRouter.handleShortcut("capture-screenshot");
        break;
      case "quick-note":
        await messageRouter.handleShortcut("quick-note");
        break;
      case "open-panel": {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.windowId) {
          await chrome.sidePanel.open({ windowId: tab.windowId });
        }
        break;
      }
    }
  } catch (err) {
    logger.error("Command error", String(err));
  }
});
