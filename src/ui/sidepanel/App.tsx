import { useState, useEffect } from "preact/hooks";
import { captures as capRepo } from "../../data/repositories";
import { settingsStore } from "../../data/settings";
import ThisTab from "./views/ThisTab";
import All from "./views/All";
import Contexts from "./views/Contexts";
import ProjectsView from "./views/Projects";

type Tab = "thistab" | "all" | "contexts" | "projects" | "settings";

export default function SidePanelApp() {
  const [activeTab, setActiveTab] = useState<Tab>("thistab");
  const [captureCount, setCaptureCount] = useState<number>(0);

  useEffect(() => {
    // Load capture count badge
    capRepo.count().then(setCaptureCount).catch(() => {});

    // Apply saved theme
    settingsStore.get("theme").then((theme) => {
      if (theme === "dark") document.documentElement.setAttribute("data-theme", "dark");
      else if (theme === "light") document.documentElement.removeAttribute("data-theme");
    }).catch(() => {});

    // Keyboard shortcuts
    function handleKeydown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "1") { e.preventDefault(); setActiveTab("thistab"); }
        else if (e.key === "2") { e.preventDefault(); setActiveTab("all"); }
        else if (e.key === "3") { e.preventDefault(); setActiveTab("contexts"); }
        else if (e.key === "4") { e.preventDefault(); setActiveTab("projects"); }
        else if (e.key === "f" || e.key === "F") {
          e.preventDefault();
          setActiveTab("all");
          setTimeout(() => (window as any).__focusAllSearch?.(), 50);
        }
      }
    }

    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, []);

  // Refresh count when captures change
  useEffect(() => {
    const handleMsg = (msg: any) => {
      if (msg?.type === "CAPTURE_SAVED") {
        capRepo.count().then(setCaptureCount).catch(() => {});
      }
    };
    chrome.runtime.onMessage.addListener(handleMsg);
    return () => chrome.runtime.onMessage.removeListener(handleMsg);
  }, []);

  return (
    <div class="container">
      <div class="header">
        <div class="app-title">ContextCapture</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            class="btn btn-icon"
            title="Options & Settings"
            aria-label="Open settings page"
            onClick={() => chrome.runtime.openOptionsPage()}
          >
            &#9881;
          </button>
        </div>
      </div>
      <nav class="nav-tabs" role="tablist">
        <button
          class={`tab ${activeTab === "thistab" ? "active" : ""}`}
          role="tab"
          aria-selected={activeTab === "thistab"}
          onClick={() => setActiveTab("thistab")}
          title="Ctrl+1"
        >
          This Tab
        </button>
        <button
          class={`tab ${activeTab === "all" ? "active" : ""}`}
          role="tab"
          aria-selected={activeTab === "all"}
          onClick={() => setActiveTab("all")}
          title="Ctrl+2"
        >
          All {captureCount > 0 && <span style={{ fontSize: 10, background: "var(--muted)", borderRadius: 10, padding: "1px 5px", marginLeft: 3 }}>{captureCount}</span>}
        </button>
        <button
          class={`tab ${activeTab === "contexts" ? "active" : ""}`}
          role="tab"
          aria-selected={activeTab === "contexts"}
          onClick={() => setActiveTab("contexts")}
          title="Ctrl+3"
        >
          Contexts
        </button>
        <button
          class={`tab ${activeTab === "projects" ? "active" : ""}`}
          role="tab"
          aria-selected={activeTab === "projects"}
          onClick={() => setActiveTab("projects")}
          title="Ctrl+4"
        >
          Projects
        </button>
        <button
          class={`tab ${activeTab === "settings" ? "active" : ""}`}
          role="tab"
          aria-selected={activeTab === "settings"}
          onClick={() => setActiveTab("settings")}
        >
          Settings
        </button>
      </nav>
      <div class="content">
        {activeTab === "thistab" && <ThisTab />}
        {activeTab === "all" && <All />}
        {activeTab === "contexts" && <Contexts />}
        {activeTab === "projects" && <ProjectsView />}
        {activeTab === "settings" && (
          <div class="empty-state" style={{ height: "auto", padding: 20 }}>
            <h3>Settings</h3>
            <p style={{ marginTop: 8, marginBottom: 16 }}>
              Manage privacy blocklist, storage usage, and data export.
            </p>
            <button
              class="btn btn-primary"
              onClick={() => chrome.runtime.openOptionsPage()}
            >
              Open Full Settings Page
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
