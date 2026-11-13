import { useState, useEffect } from "preact/hooks";
import { captures as capRepo } from "../../data/repositories";
import { settingsStore } from "../../data/settings";
import ThisTab from "./views/ThisTab";
import All from "./views/All";
import Contexts from "./views/Contexts";
import ProjectsView from "./views/Projects";
import CaptureDetail from "./views/Detail";
import AssistantView from "./views/Assistant";
import { SettingsIcon, SparklesIcon } from "../components/Icons";

type Tab = "thistab" | "all" | "contexts" | "projects" | "assistant";

export default function SidePanelApp() {
  const [activeTab, setActiveTab] = useState<Tab>("thistab");
  const [captureCount, setCaptureCount] = useState<number>(0);
  const [detailCaptureId, setDetailCaptureId] = useState<string | null>(null);
  const [assistantInitialQuery, setAssistantInitialQuery] = useState<string | null>(null);

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

  // Refresh count whenever active tab changes
  useEffect(() => {
    capRepo.count().then(setCaptureCount).catch(() => {});
  }, [activeTab, detailCaptureId]);

  // Refresh count when captures change or handle navigation
  useEffect(() => {
    const handleMsg = (msg: any) => {
      if (msg?.type === "CAPTURE_SAVED" || msg?.type === "CAPTURE_DELETED" || msg?.type === "CAPTURES_CHANGED") {
        capRepo.count().then(setCaptureCount).catch(() => {});
      } else if (msg?.type === "NAVIGATE_PANEL") {
        if (msg.targetTab) {
          setActiveTab(msg.targetTab);
          setDetailCaptureId(null);
        }
        if (msg.prefillQuery) {
          setAssistantInitialQuery(msg.prefillQuery);
        }
      }
    };
    chrome.runtime.onMessage.addListener(handleMsg);
    return () => chrome.runtime.onMessage.removeListener(handleMsg);
  }, []);

  return (
    <div class="container">
      {/* ── App Header ── */}
      <header class="sp-header">
        <div class="sp-brand">
          <span class="sp-brand-dot" />
          <span class="sp-brand-name">ContextCapture</span>
        </div>
        <div class="sp-header-actions">
          <button
            class="sp-icon-btn"
            title="Search (Ctrl+F)"
            aria-label="Search captures"
            onClick={() => { setActiveTab("all"); setDetailCaptureId(null); setTimeout(() => (window as any).__focusAllSearch?.(), 50); }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </button>
          <button
            class="sp-icon-btn"
            title="Settings"
            aria-label="Open settings page"
            onClick={() => chrome.runtime.openOptionsPage()}
          >
            <SettingsIcon size={15} />
          </button>
        </div>
      </header>

      {/* ── Nav Tabs ── */}
      <nav class="sp-nav" role="tablist">
        <button
          class={`sp-tab ${activeTab === "thistab" && !detailCaptureId ? "active" : ""}`}
          role="tab"
          onClick={() => { setActiveTab("thistab"); setDetailCaptureId(null); }}
          title="Ctrl+1"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/>
          </svg>
          Tab
        </button>
        <button
          class={`sp-tab ${activeTab === "all" && !detailCaptureId ? "active" : ""}`}
          role="tab"
          onClick={() => { setActiveTab("all"); setDetailCaptureId(null); }}
          title="Ctrl+2"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
          Library
          {captureCount > 0 && <span class="sp-count-badge">{captureCount}</span>}
        </button>
        <button
          class={`sp-tab ${activeTab === "contexts" && !detailCaptureId ? "active" : ""}`}
          role="tab"
          onClick={() => { setActiveTab("contexts"); setDetailCaptureId(null); }}
          title="Ctrl+3"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>
          </svg>
          Contexts
        </button>
        <button
          class={`sp-tab ${activeTab === "projects" && !detailCaptureId ? "active" : ""}`}
          role="tab"
          onClick={() => { setActiveTab("projects"); setDetailCaptureId(null); }}
          title="Ctrl+4"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          Projects
        </button>
        <button
          class={`sp-tab ${activeTab === "assistant" && !detailCaptureId ? "active" : ""}`}
          role="tab"
          onClick={() => { setActiveTab("assistant"); setDetailCaptureId(null); }}
          title="Ctrl+5"
        >
          <SparklesIcon size={12} color="currentColor" />
          Assistant
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
            {activeTab === "assistant" && (
              <AssistantView
                onViewDetail={(id) => setDetailCaptureId(id)}
                initialQuery={assistantInitialQuery ?? undefined}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
