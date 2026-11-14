import { describe, expect, it, vi } from "vitest";
import { getActiveTab } from "../../src/ui/sidepanel/activeTab";

describe("side panel active tab lookup", () => {
  it("falls back to the last focused browser window for GitHub tabs", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 42,
          windowId: 7,
          url: "https://github.com/raju-2313/context-capture",
          title: "context-capture",
        },
      ]);

    (globalThis as any).chrome.tabs.query = query;

    await expect(getActiveTab()).resolves.toMatchObject({
      id: 42,
      windowId: 7,
      url: "https://github.com/raju-2313/context-capture",
    });
    expect(query).toHaveBeenNthCalledWith(1, {
      active: true,
      lastFocusedWindow: true,
    });
    expect(query).toHaveBeenNthCalledWith(2, {
      active: true,
      currentWindow: true,
    });
  });
});
