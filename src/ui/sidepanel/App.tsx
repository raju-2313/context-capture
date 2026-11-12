import { useState, useEffect } from "preact/hooks";
import { captures as capRepo } from "../../data/repositories";
import { settingsStore } from "../../data/settings";
import ThisTab from "./views/ThisTab";
import All from "./views/All";
import Contexts from "./views/Contexts";
import ProjectsView from "./views/Projects";
import CaptureDetail from "./views/Detail";
import AssistantView from "./views/Assistant";

type Tab = "thistab" | "all" | "contexts" | "projects" | "assistant" | "settings";

export default function SidePanelApp() {
  const [activeTab, setActiveTab] = useState<Tab>("thistab");
  const [captureCount, setCaptureCount] = useState<number>(0);
  const [detailCaptureId, setDetailCaptureId] = useState<string | null>(null);

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
        if (e.key === "1") { e.preventDefault(); setActiveTab("thistab"); setDetailCaptureId(null); }
        else if (e.key === "2") { e.preventDefault(); setActiveTab("all"); setDetailCaptureId(null); }
        else if (e.key === "3") { e.preventDefault(); setActiveTab("contexts"); setDetailCaptureId(null); }
        else if (e.key === "4") { e.preventDefault(); setActiveTab("projects"); setDetailCaptureId(null); }
        else if (e.key === "5") { e.preventDefault(); setActiveTab("assistant"); setDetailCaptureId(null); }
        else if (e.key === "f" || e.key === "F") {
          e.preventDefault();
          setActiveTab("all");
          setDetailCaptureId(null);
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
          class={`tab ${activeTab === "thistab" && !detailCaptureId ? "active" : ""}`}
          role="tab"
          aria-selected={activeTab === "thistab"}
          onClick={() => { setActiveTab("thistab"); setDetailCaptureId(null); }}
          title="Ctrl+1"
        >
          This Tab
        </button>
        <button
          class={`tab ${activeTab === "all" && !detailCaptureId ? "active" : ""}`}
          role="tab"
          aria-selected={activeTab === "all"}
          onClick={() => { setActiveTab("all"); setDetailCaptureId(null); }}
          title="Ctrl+2"
        >
          All {captureCount > 0 && <span style={{ fontSize: 10, background: "var(--muted)", borderRadius: 10, padding: "1px 5px", marginLeft: 3 }}>{captureCount}</span>}
        </button>
        <button
          class={`tab ${activeTab === "contexts" && !detailCaptureId ? "active" : ""}`}
          role="tab"
          aria-selected={activeTab === "contexts"}
          onClick={() => { setActiveTab("contexts"); setDetailCaptureId(null); }}
          title="Ctrl+3"
        >
          Contexts
        </button>
        <button
          class={`tab ${activeTab === "projects" && !detailCaptureId ? "active" : ""}`}
          role="tab"
          aria-selected={activeTab === "projects"}
          onClick={() => { setActiveTab("projects"); setDetailCaptureId(null); }}
          title="Ctrl+4"
        >
          Projects
        </button>
        <button
          class={`tab ${activeTab === "assistant" && !detailCaptureId ? "active" : ""}`}
          role="tab"
          aria-selected={activeTab === "assistant"}
          onClick={() => { setActiveTab("assistant"); setDetailCaptureId(null); }}
          title="Ctrl+5"
        >
          🤖 AI
        </button>
        <button
          class={`tab ${activeTab === "settings" && !detailCaptureId ? "active" : ""}`}
          role="tab"
          aria-selected={activeTab === "settings"}
          onClick={() => { setActiveTab("settings"); setDetailCaptureId(null); }}
        >
          Settings
        </button>
      </nav>
      <div class="content">
        {detailCaptureId ? (
          <CaptureDetail
            captureId={detailCaptureId}
            onBack={() => setDetailCaptureId(null)}
            onSelectCapture={(id) => setDetailCaptureId(id)}
          />
        ) : (
          <>
            {activeTab === "thistab" && <ThisTab onViewDetail={(id) => setDetailCaptureId(id)} />}
            {activeTab === "all" && <All onViewDetail={(id) => setDetailCaptureId(id)} />}
            {activeTab === "contexts" && <Contexts />}
            {activeTab === "projects" && <ProjectsView onViewDetail={(id) => setDetailCaptureId(id)} />}
            {activeTab === "assistant" && <AssistantView onViewDetail={(id) => setDetailCaptureId(id)} />}
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
          </>
        )}
      </div>
    </div>
  );
}
