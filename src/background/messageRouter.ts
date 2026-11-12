import { capturePipeline } from "../core/capture/pipeline";
import { contextLifecycle } from "../core/context/lifecycle";
import { ExtensionMessage, ExtensionResponse, createResponse, createErrorResponse } from "../shared/messages";
import { ExtensionError } from "../shared/errors";
import { logger } from "../shared/logger";

export class MessageRouter {
  async route(message: ExtensionMessage, _sender: chrome.runtime.MessageSender, sendResponse: (resp: ExtensionResponse) => void): Promise<boolean> {
    try {
      let result: any;
      switch (message.type) {
        case "CAPTURE_TEXT":
          result = await capturePipeline.captureText(message.payload);
          break;
        case "CAPTURE_NOTE":
          result = await capturePipeline.captureNote(message.payload);
          break;
        case "CAPTURE_QUESTION":
          result = await capturePipeline.captureQuestion(message.payload);
          break;
        case "CAPTURE_LINK":
          result = await capturePipeline.captureLink(message.payload);
          break;
        case "CAPTURE_CODE":
          result = await capturePipeline.captureCode(message.payload);
          break;
        case "CAPTURE_SCREENSHOT":
          result = await capturePipeline.captureScreenshot(message.payload);
          break;
        case "GET_CONTEXT_FOR_TAB":
          result = await contextLifecycle.getContextForTab(message.payload.tabId);
          break;
        case "LIST_CONTEXTS":
          result = message.payload.status === "archived"
            ? await contextLifecycle.listArchived()
            : await contextLifecycle.listActive();
          break;
        case "REBIND_CONTEXT":
          await contextLifecycle.rebindToTab(message.payload.context_id, message.payload.tabId, message.payload.windowId);
          result = { success: true };
          break;
        case "RECONCILE_BINDINGS":
          await contextLifecycle.reconcileOnStartup();
          result = { success: true };
          break;
        default:
          sendResponse(createErrorResponse(message.id, "UNKNOWN_MESSAGE", `Unknown message type: ${message.type}`));
          return true;
      }
      sendResponse(createResponse(message.id, result));
      return true;
    } catch (err) {
      logger.error("Message handler error", String(err));
      if (err instanceof ExtensionError) {
        sendResponse(createErrorResponse(message.id, err.code, err.message));
      } else {
        sendResponse(createErrorResponse(message.id, "INTERNAL_ERROR", String(err)));
      }
      return true;
    }
  }

  async handleShortcut(command: string): Promise<void> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;

    switch (command) {
      case "capture-text": {
        const [res] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["/injected/readSelection.js"],
        });
        const selection = (res as any)?.result?.selection ?? "";
        if (selection.trim()) {
          await capturePipeline.captureText({
            text: selection,
            tabId: tab.id,
            windowId: tab.windowId,
          });
        }
        break;
      }
      case "capture-screenshot":
        await capturePipeline.captureScreenshot({
          tabId: tab.id,
          windowId: tab.windowId,
        });
        try {
          if (chrome.sidePanel?.open) {
            await chrome.sidePanel.open({ windowId: tab.windowId });
          }
        } catch {}
        break;
      case "quick-note":
        await chrome.windows.create({
          url: chrome.runtime.getURL("/popup/index.html"),
          type: "popup",
          width: 400,
          height: 500,
        });
        break;
    }
  }
}

export const messageRouter = new MessageRouter();