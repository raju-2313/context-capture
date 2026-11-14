import { useState, useEffect } from "preact/hooks";
import { render } from "preact/compat";
import { BookmarkIcon, ContextIcon, ExpandIcon, GlobeIcon, NoteIcon, QuestionIcon, ScreenshotIcon } from "../components/Icons";
import { captures as capRepo, contexts as ctxRepo } from "../../data/repositories";
import { sessionStore } from "../../data/sessionStore";

// ── tiny inline icons (no extra file deps) ──────────────────────────────────
const IcoAsk = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);
const IcoHighlight = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);
const IcoLib = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);
const IcoCog = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);
const IcoCtx = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
  </svg>
);
const IcoKbd = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M6 16h12" />
  </svg>
);

interface TabInfo {
  title: string;
  url: string;
  domain: string;
  id?: number;
  windowId?: number;
}

export default function QuickAdd() {
  const [text, setText] = useState("");
  const [type, setType] = useState<"note" | "question">("note");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<TabInfo | null>(null);
  const [captureCount, setCaptureCount] = useState<number>(0);
  const [contextName, setContextName] = useState<string>("New Context");
  const [showKbd, setShowKbd] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load active tab info and context
    chrome.tabs.query({ active: true, currentWindow: true }).then(async ([t]) => {
      if (t?.url) {
        try {
          const u = new URL(t.url);
          setTab({
            title: t.title || "Untitled",
            url: t.url,
            domain: u.hostname.replace("www.", ""),
            id: t.id,
            windowId: t.windowId,
          });
        } catch {
          setTab({ title: t.title || "Untitled", url: t.url || "", domain: "", id: t.id, windowId: t.windowId });
        }
      }

      if (t?.id) {
        try {
          const binding = await sessionStore.getBinding(t.id);
          if (binding?.context_id) {
            const ctx = await ctxRepo.get(binding.context_id);
            if (ctx?.title) setContextName(ctx.title);
          }
        } catch {}
      }
    });

    // Load real capture count
    capRepo.count().then(setCaptureCount).catch(() => {});
  }, []);

  async function save() {
    if (!text.trim()) return;
    setLoading(true);
    try {
      if (type === "note") {
        await chrome.runtime.sendMessage({
          type: "CAPTURE_NOTE",
          payload: { text, tabId: tab?.id || null, windowId: tab?.windowId || null },
        });
      } else {
        await chrome.runtime.sendMessage({
          type: "CAPTURE_QUESTION",
          payload: { text, tabId: tab?.id || null, windowId: tab?.windowId || null },
        });
      }
      setSaved(true);
      setTimeout(() => window.close(), 600);
    } finally {
      setLoading(false);
    }
  }

  async function handleTakeScreenshot() {
    setLoading(true);
    try {
      if (tab?.id && tab?.windowId) {
        await chrome.runtime.sendMessage({
          type: "CAPTURE_SCREENSHOT",
          payload: { tabId: tab.id, windowId: tab.windowId },
        });
        if (chrome.sidePanel?.open) await chrome.sidePanel.open({ windowId: tab.windowId });
      }
    } finally { window.close(); }
  }

  async function handleBookmarkTab() {
    setLoading(true);
    try {
      if (tab?.id && tab?.url) {
        await chrome.runtime.sendMessage({
          type: "CAPTURE_LINK",
          payload: { url: tab.url, title: tab.title, tabId: tab.id, windowId: tab.windowId },
        });
      }
    } finally { window.close(); }
  }

  async function handleHighlight() {
    setLoading(true);
    try {
      if (tab?.id) {
        const res = await chrome.tabs.sendMessage(tab.id, { type: "GET_SELECTION" }).catch(() => null);
        const selectedText = res?.text || "";
        if (selectedText) {
          await chrome.runtime.sendMessage({
            type: "CAPTURE_NOTE",
            payload: { text: selectedText, tabId: tab.id, windowId: tab.windowId },
          });
        }
      }
    } finally { window.close(); }
  }

  async function openPanel(tab_?: "library" | "assistant") {
    if (tab?.windowId && chrome.sidePanel?.open) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
      if (tab_) {
        setTimeout(() => {
          chrome.runtime.sendMessage({ type: "NAVIGATE_TAB", payload: { tab: tab_ } });
        }, 150);
      }
    }
    window.close();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      save();
    }
    if (e.key === "Escape") window.close();
  }

  const domainShort = tab?.domain ? (tab.domain.length > 28 ? tab.domain.slice(0, 28) + "…" : tab.domain) : "";
  const titleShort = tab?.title ? (tab.title.length > 36 ? tab.title.slice(0, 36) + "…" : tab.title) : "Loading…";

  return (
    <div class="pq-root">
      {/* ── Header ───────────────────────────────────── */}
      <div class="pq-header">
        <div class="pq-brand">
          <ContextIcon class="pq-brand-icon" size={14} color="var(--lime)" />
          <span class="pq-brand-name">ContextCapture</span>
          <span class="pq-pro-badge">PRO</span>
        </div>
        <div class="pq-header-actions">
          <button class="pq-icon-btn" title="Keyboard shortcuts" onClick={() => setShowKbd(s => !s)}>
            <IcoKbd />
          </button>
          <button class="pq-icon-btn" title="Settings" onClick={() => chrome.runtime.openOptionsPage()}>
            <IcoCog />
          </button>
        </div>
      </div>

      {/* ── Current page strip ───────────────────────── */}
      <div class="pq-page-strip">
        <GlobeIcon class="pq-page-icon" size={13} color="var(--lime)" />
        <div class="pq-page-info">
          <span class="pq-page-title">{titleShort}</span>
          {domainShort && <span class="pq-page-domain">{domainShort}</span>}
        </div>
      </div>

      {/* ── Stats row ────────────────────────────────── */}
      <div class="pq-stats-row">
        <div class="pq-stat-chip">
          <IcoCtx />
          <span class="pq-stat-label">{contextName}</span>
        </div>
        <div class="pq-stat-chip">
          <span class="pq-stat-num">{captureCount}</span>
          <span class="pq-stat-label">captures</span>
        </div>
      </div>

      {/* ── Type toggle ──────────────────────────────── */}
      <div class="pq-type-row">
        <div class="pq-toggle-group">
          <button
            class={`pq-toggle ${type === "note" ? "pq-toggle--active" : ""}`}
            onClick={() => setType("note")}
          >
            <NoteIcon size={11} /> Note
          </button>
          <button
            class={`pq-toggle ${type === "question" ? "pq-toggle--active" : ""}`}
            onClick={() => setType("question")}
          >
            <QuestionIcon size={11} /> Question
          </button>
        </div>
        <span class="pq-kbd-hint">⌘/Ctrl+↵ save · Esc close</span>
      </div>

      {/* ── Textarea ─────────────────────────────────── */}
      <div class="pq-composer-wrap">
        <textarea
          class="pq-composer"
          rows={3}
          value={text}
          onInput={(e) => setText(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            type === "note"
              ? "Type a quick note or insight…"
              : "What are you investigating on this page?"
          }
          autoFocus
        />
        <div class="pq-composer-footer">
          <span class="pq-char-count">{text.length > 0 ? `${text.length} chars` : ""}</span>
          <button
            class={`pq-save-btn ${saved ? "pq-save-btn--done" : ""}`}
            onClick={save}
            disabled={!text.trim() || loading}
          >
            {saved ? "✓ Saved" : loading ? "Saving…" : "Save ↵"}
          </button>
        </div>
      </div>

      {/* ── Quick action grid ────────────────────────── */}
      <div class="pq-section-label">PAGE ACTIONS</div>
      <div class="pq-action-grid">
        <button class="pq-action-btn" onClick={handleTakeScreenshot} disabled={loading} title="Capture screenshot">
          <ScreenshotIcon size={16} color="var(--lime)" />
          <span>Screenshot</span>
        </button>
        <button class="pq-action-btn" onClick={handleBookmarkTab} disabled={loading} title="Bookmark this page">
          <BookmarkIcon size={16} color="var(--lime)" />
          <span>Bookmark</span>
        </button>
        <button class="pq-action-btn" onClick={handleHighlight} disabled={loading} title="Capture selected text">
          <IcoHighlight />
          <span>Highlight</span>
        </button>
        <button class="pq-action-btn" onClick={() => openPanel("assistant")} title="Open AI assistant">
          <IcoAsk />
          <span>Ask AI</span>
        </button>
      </div>

      {/* ── Keyboard shortcuts panel ─────────────────── */}
      {showKbd && (
        <div class="pq-kbd-panel">
          <div class="pq-kbd-row"><kbd>Ctrl+Shift+S</kbd><span>Open side panel</span></div>
          <div class="pq-kbd-row"><kbd>Ctrl+Shift+H</kbd><span>Capture highlight</span></div>
          <div class="pq-kbd-row"><kbd>Ctrl+1–5</kbd><span>Switch panel tab</span></div>
          <div class="pq-kbd-row"><kbd>Esc</kbd><span>Close popup</span></div>
        </div>
      )}

      {/* ── Footer nav ───────────────────────────────── */}
      <div class="pq-footer">
        <button class="pq-footer-btn" onClick={() => openPanel()} title="Open side panel">
          <ExpandIcon size={11} /> Panel
        </button>
        <button class="pq-footer-btn" onClick={() => openPanel("library")} title="Open library">
          <IcoLib /> Library
        </button>
        <div class="pq-footer-divider" />
        <button class="pq-footer-btn pq-footer-btn--muted" onClick={() => window.close()}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

render(<QuickAdd />, document.getElementById("root")!);
