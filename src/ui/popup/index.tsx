import { useState } from "preact/hooks";
import { render } from "preact/compat";

export default function QuickAdd() {
  const [text, setText] = useState("");
  const [type, setType] = useState<"note" | "question">("note");

  async function save() {
    if (!text.trim()) return;
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

  function handleKeyDown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      save();
    }
  }

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12, minWidth: 320 }}>
      <h2 style={{ fontSize: 16, marginBottom: 4 }}>{type === "note" ? "Quick Note" : "Question"}</h2>
      <textarea
        class="textarea"
        value={text}
        onInput={(e) => setText(e.currentTarget.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your note or question... (Ctrl+Enter to save)"
        autoFocus
      />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button class="btn" onClick={() => setType(type === "note" ? "question" : "note")}>{type === "note" ? "Switch to Question" : "Switch to Note"}</button>
        <button class="btn btn-primary" onClick={save} disabled={!text.trim()}>Save</button>
        <button class="btn" onClick={async () => {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab?.windowId) {
            await chrome.sidePanel.open({ windowId: tab.windowId });
            window.close();
          }
        }}>Side Panel</button>
        <button class="btn" onClick={() => window.close()}>Cancel</button>
      </div>
    </div>
  );
}

render(<QuickAdd />, document.getElementById("root")!);
