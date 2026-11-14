export type SidePanelTab = "thistab" | "all" | "contexts" | "projects" | "assistant";

export function navigateToTab(
  tab: SidePanelTab,
  setActiveTab: (tab: SidePanelTab) => void,
  clearDetail: () => void,
): void {
  setActiveTab(tab);
  clearDetail();
}
