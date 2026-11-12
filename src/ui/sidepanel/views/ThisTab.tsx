import { useState, useEffect } from "preact/hooks";
import { capturePipeline } from "../../../core/capture/pipeline";
import { contextLifecycle } from "../../../core/context/lifecycle";
import { captures as capRepo, contexts as ctxRepo } from "../../../data/repositories";
import { CaptureCard } from "../../components/CaptureCard";

export default function ThisTab() {
  const [contextId, setContextId] = useState<string | null>(null);
  const [contextTitle, setContextTitle] = useState("New Context");
  const [captures, setCaptures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();

    const handleActivated = () => {
      load();
    };

    const handleUpdated = (_tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (changeInfo.status === "complete") {
        load();
      }
    };

    const handleMessage = (msg: any) => {
      if (msg?.type === "CAPTURE_SAVED" || msg?.type === "CONTEXT_CHANGED") {
        load();
      }
    };

    chrome.tabs.onActivated.addListener(handleActivated);
    chrome.tabs.onUpdated.addListener(handleUpdated);
    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      chrome.tabs.onActivated.removeListener(handleActivated);
      chrome.tabs.onUpdated.removeListener(handleUpdated);
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  async function load() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) {
        setLoading(false);
        return;
      }
      const cid = await contextLifecycle.getOrCreateForTab(tab.id, tab.windowId);
      setContextId(cid);

      const [ctx, caps] = await Promise.all([
        ctxRepo.get(cid),
        capRepo.listByContext(cid),
      ]);

      setContextTitle(ctx?.title || "New Context");
      setCaptures(caps);
    } catch (err) {
      console.error("Failed to load tab context", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleTitleChange(newTitle: string) {
    const trimmed = newTitle.trim() || "Untitled Context";
    setContextTitle(trimmed);
    if (contextId) {
      await contextLifecycle.renameContext(contextId, trimmed);
    }
  }

  async function captureText(text: string) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;
    await capturePipeline.captureText({ text, tabId: tab.id, windowId: tab.windowId });
    await load();
  }

  async function captureScreenshot() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;
    await capturePipeline.captureScreenshot({ tabId: tab.id, windowId: tab.windowId });
    await load();
  }

  async function deleteCapture(id: string) {
    await capRepo.softDelete(id);
    await load();
  }

  if (loading) return <div class="empty-state">Loading...</div>;
  if (!contextId) return <div class="empty-state">No active tab</div>;

  return (
    <div class="container">
      <div class="context-header">
        <div
          class="context-title"
          contentEditable={true}
          onBlur={(e: any) => handleTitleChange(e.currentTarget.textContent || "")}
          onKeyDown={(e: KeyboardEvent) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.currentTarget as HTMLElement).blur();
            }
          }}
          title="Click to edit context title"
        >
          {contextTitle}
        </div>
        <div class="context-meta">{captures.length} captures &bull; Active context</div>
      </div>

      <div class="quick-add-bar">
        <button class="btn btn-primary" onClick={captureScreenshot} title="Capture visible screen">Screenshot</button>
        <button class="btn" onClick={() => {
          const t = prompt("Enter text to capture:");
          if (t) captureText(t);
        }}>Capture Text</button>
        <button class="btn" onClick={() => {
          const t = prompt("Enter a note:");
          if (t) capturePipeline.captureNote({ text: t, tabId: null, windowId: null }).then(() => load());
        }}>Quick Note</button>
        <button class="btn" onClick={async () => {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab && tab.url && tab.id) {
            await capturePipeline.captureLink({
              url: tab.url,
              title: tab.title || undefined,
              tabId: tab.id,
              windowId: tab.windowId,
            });
            await load();
          }
        }}>Bookmark Page</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {captures.length === 0 ? (
          <div class="empty-state" style={{ height: "auto" }}>
            <p>No captures in this tab context yet.</p>
            <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 6 }}>
              Select text on the webpage, capture a screenshot, or add a quick note.
            </p>
          </div>
        ) : (
          captures.map((cap) => (
            <CaptureCard
              key={cap.capture_id}
              capture={cap}
              onDelete={() => deleteCapture(cap.capture_id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
