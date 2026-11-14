import { describe, it, expect, vi, beforeEach } from "vitest";
import { messageRouter } from "../../src/background/messageRouter";
import { capturePipeline } from "../../src/core/capture/pipeline";

describe("Selection tooltip & in-page popup routing", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("routes CAPTURE_TEXT with fallback to sender tab and window IDs", async () => {
    const captureSpy = vi.spyOn(capturePipeline, "captureText").mockResolvedValue("cap-123");
    let response: any = null;

    const handled = await messageRouter.route(
      {
        id: "msg-1",
        type: "CAPTURE_TEXT",
        timestamp: Date.now(),
        payload: {
          text: "Selected text from document",
          tabId: 0,
          windowId: 0,
          anchor: { prefix: "before", suffix: "after" },
          highlightColor: "#d1d5db",
        },
      },
      {
        tab: {
          id: 42,
          windowId: 7,
        } as any,
      },
      (resp) => {
        response = resp;
      }
    );

    expect(handled).toBe(true);
    expect(captureSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Selected text from document",
        tabId: 42,
        windowId: 7,
        anchor: { prefix: "before", suffix: "after" },
        highlightColor: "#d1d5db",
      })
    );
    expect(response?.success).toBe(true);
    expect(response?.data).toBe("cap-123");
  });

  it("routes OPEN_PANEL and triggers sidePanel.open", async () => {
    (globalThis as any).chrome = {
      sidePanel: {
        open: vi.fn().mockResolvedValue(undefined),
      },
      runtime: {
        sendMessage: vi.fn().mockResolvedValue(undefined),
      },
    };

    let response: any = null;
    const handled = await messageRouter.route(
      {
        id: "msg-2",
        type: "OPEN_PANEL",
        timestamp: Date.now(),
        payload: {
          targetTab: "assistant",
          prefillQuery: "Explain this selection",
        },
      },
      {
        tab: {
          id: 42,
          windowId: 99,
        } as any,
      },
      (resp) => {
        response = resp;
      }
    );

    expect(handled).toBe(true);
    expect((globalThis as any).chrome.sidePanel.open).toHaveBeenCalledWith({ windowId: 99 });
    expect(response?.success).toBe(true);
  });

  it("persists a changed highlight color through the existing router", async () => {
    const updateSpy = vi.spyOn(capturePipeline, "updateHighlightColor").mockResolvedValue(undefined);
    let response: any = null;
    await messageRouter.route(
      {
        id: "msg-color",
        type: "UPDATE_HIGHLIGHT_COLOR",
        timestamp: Date.now(),
        payload: { capture_id: "cap-123", color: "#fef08a" },
      },
      { tab: {} as any },
      (resp) => { response = resp; }
    );
    expect(updateSpy).toHaveBeenCalledWith("cap-123", "#fef08a");
    expect(response?.success).toBe(true);
  });

  it("opens the dedicated side panel from the selection tooltip footer", async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    (globalThis as any).chrome.runtime = {
      sendMessage,
      onMessage: {
        addListener: vi.fn(),
      },
    };
    delete (window as any).__CC_SELECTION_TOOLTIP_LOADED__;

    const range = {
      getBoundingClientRect: () => ({ left: 100, top: 100, width: 40, height: 20, bottom: 120 }),
      getClientRects: () => [],
    };
    const selection = {
      isCollapsed: false,
      rangeCount: 1,
      toString: () => "selected text",
      getRangeAt: () => range,
    };
    vi.spyOn(window, "getSelection").mockReturnValue(selection as any);

    await import("../../src/content/selectionTooltip");
    document.dispatchEvent(new MouseEvent("mouseup"));
    await new Promise((resolve) => setTimeout(resolve, 140));

    const host = document.querySelector("#cc-selection-tooltip-host") as HTMLElement;
    const shadow = host.shadowRoot as ShadowRoot;
    (shadow.querySelector("#cc-pill-btn") as HTMLElement).click();

    const sidePanelButton = shadow.querySelector(".cc-sidepanel-button") as HTMLButtonElement;
    expect(sidePanelButton).not.toBeNull();
    sidePanelButton.click();

    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: "OPEN_PANEL",
      payload: { targetTab: "thistab" },
    }));
  });

});
