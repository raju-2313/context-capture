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
});
