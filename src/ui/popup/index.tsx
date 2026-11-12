import { useState } from "preact/hooks";
import { render } from "preact/compat";
import { ScreenshotIcon, BookmarkIcon, ExpandIcon, NoteIcon, QuestionIcon } from "../components/Icons";

export default function QuickAdd() {
  const [text, setText] = useState("");
  const [type, setType] = useState<"note" | "question">("note");
  const [loading, setLoading] = useState(false);

  async function save() {
    if (!text.trim()) return;
    setLoading(true);
    if (type === "note") {
      await chrome.runtime.sendMessage({
        type: "CAPTURE_NOTE",
        payload: { text, tabId: null, windowId: null },
      });
    } else {
      await chrome.runtime.sendMessage({
        type: "CAPTURE_QUESTION",
        payload: { text, tabId: null },
      });
    }
    window.close();
  }

  async function handleTakeScreenshot() {
    setLoading(true);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id && tab?.windowId) {
        await chrome.runtime.sendMessage({
          type: "CAPTURE_SCREENSHOT",
          payload: { tabId: tab.id, windowId: tab.windowId },
        });
        if (chrome.sidePanel?.open) {
          await chrome.sidePanel.open({ windowId: tab.windowId });
        }
      }
    } finally {
      window.close();
    }
  }

  async function handleBookmarkTab() {
    setLoading(true);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id && tab?.url) {
        await chrome.runtime.sendMessage({
          type: "CAPTURE_LINK",
          payload: {
            url: tab.url,
            title: tab.title || undefined,
            tabId: tab.id,
            windowId: tab.windowId,
          },
        });
      }
    } finally {
      window.close();
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      save();
    }
  }

  return (
    <div
      style={{
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        minWidth: 340,
        background: "var(--bg, #090e17)",
        color: "#ffffff",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--sunset-orange, #ff6b35)", boxShadow: "0 0 8px var(--sunset-orange, #ff6b35)" }}></span>
          <strong style={{ fontSize: 13, letterSpacing: "-0.01em", color: "#ffffff" }}>ContextCapture</strong>
        </div>
        <div style={{ display: "flex", gap: 4, background: "var(--surface, #142036)", padding: 2, borderRadius: 6, border: "1px solid var(--border)" }}>
          <button
            class="btn"
            style={{
              padding: "3px 8px",
              fontSize: 11,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              background: type === "note" ? "var(--ocean-blue, #0284c7)" : "transparent",
              color: type === "note" ? "#ffffff" : "var(--text-secondary)",
              border: "none",
            }}
            onClick={() => setType("note")}
          >
            <NoteIcon size={12} /> Note
          </button>
          <button
            class="btn"
            style={{
              padding: "3px 8px",
              fontSize: 11,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              background: type === "question" ? "var(--sunset-orange, #ff6b35)" : "transparent",
              color: type === "question" ? "#ffffff" : "var(--text-secondary)",
              border: "none",
            }}
            onClick={() => setType("question")}
          >
            <QuestionIcon size={12} /> Question
          </button>
        </div>
      </div>

      {/* Textarea */}
      <textarea
        class="input"
        rows={4}
        value={text}
        onInput={(e) => setText(e.currentTarget.value)}
        onKeyDown={handleKeyDown}
        placeholder={type === "note" ? "Type a quick note or thought... (Ctrl+Enter to save)" : "What question are you investigating? (Ctrl+Enter)"}
        style={{ width: "100%", resize: "vertical", fontSize: 13, padding: 10 }}
        autoFocus
      />

      {/* One-click page actions */}
      <div style={{ display: "flex", gap: 6 }}>
        <button
          class="btn"
          style={{ flex: 1, fontSize: 11.5, padding: "7px 8px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          onClick={handleTakeScreenshot}
          disabled={loading}
          title="Capture active tab screenshot and open side panel"
        >
          <ScreenshotIcon size={14} color="var(--ocean-blue, #0284c7)" /> Screenshot
        </button>
        <button
          class="btn"
          style={{ flex: 1, fontSize: 11.5, padding: "7px 8px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          onClick={handleBookmarkTab}
          disabled={loading}
          title="Bookmark active webpage into current context"
        >
          <BookmarkIcon size={14} color="var(--ocean-blue, #0284c7)" /> Bookmark
        </button>
      </div>

      {/* Footer controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 4, borderTop: "1px solid var(--border)" }}>
        <button
          class="btn"
          style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}
          onClick={async () => {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab?.windowId && chrome.sidePanel?.open) {
              await chrome.sidePanel.open({ windowId: tab.windowId });
              window.close();
            }
          }}
        >
          <ExpandIcon size={12} /> Open Panel
        </button>
        <div style={{ display: "flex", gap: 6 }}>
          <button class="btn" style={{ fontSize: 11 }} onClick={() => window.close()}>
            Cancel
          </button>
          <button class="btn btn-primary" style={{ fontSize: 11 }} onClick={save} disabled={!text.trim() || loading}>
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

render(<QuickAdd />, document.getElementById("root")!);
