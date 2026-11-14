import { describe, expect, it, vi } from "vitest";
import { navigateToTab } from "../../src/ui/sidepanel/navigation";

describe("side panel navigation", () => {
  it("navigates to the library and clears an open detail view", () => {
    const setActiveTab = vi.fn();
    const clearDetail = vi.fn();

    navigateToTab("all", setActiveTab, clearDetail);

    expect(setActiveTab).toHaveBeenCalledWith("all");
    expect(clearDetail).toHaveBeenCalledOnce();
  });
});
