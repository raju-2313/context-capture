import { useState, useEffect } from "preact/hooks";
import { capturePipeline } from "../../../core/capture/pipeline";
import { contextLifecycle } from "../../../core/context/lifecycle";
import { captures as capRepo, contexts as ctxRepo } from "../../../data/repositories";
import { CaptureCard } from "../../components/CaptureCard";
import { voiceNoteIntegration, VoiceRecordingState } from "../../../core/integrations/voice";

export default function ThisTab({ onViewDetail }: { onViewDetail?: (id: string) => void } = {}) {
  const [contextId, setContextId] = useState<string | null>(null);
  const [contextTitle, setContextTitle] = useState("New Context");
  const [captures, setCaptures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [voiceState, setVoiceState] = useState<VoiceRecordingState>({
    isRecording: false,
    transcript: "",
    interimTranscript: "",
  });

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
        <button
          class="btn"
          style={{ background: voiceState.isRecording ? "var(--danger)" : "var(--muted)", color: voiceState.isRecording ? "#fff" : "inherit" }}
          onClick={async () => {
            if (voiceState.isRecording) {
              voiceNoteIntegration.stopRecording();
            } else {
              const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
              voiceNoteIntegration.startRecording(
                (state) => setVoiceState(state),
                async (finalText) => {
                  if (finalText) {
                    await voiceNoteIntegration.saveVoiceCapture(finalText, tab?.id ?? null, tab?.windowId ?? null);
                    await load();
                  }
                }
              );
            }
          }}
          title="Record a voice note"
        >
          {voiceState.isRecording ? "⏹ Stop" : "🎤 Voice"}
        </button>
      </div>

      {voiceState.isRecording && (
        <div
          style={{
            padding: "8px 12px",
            background: "#ff3b3015",
            border: "1px solid var(--danger)",
            borderRadius: 8,
            marginBottom: 10,
            fontSize: 12,
          }}
        >
          <div style={{ fontWeight: 600, color: "var(--danger)", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ animation: "pulse 1s infinite" }}>🔴</span> Recording Voice Note...
          </div>
          <div style={{ marginTop: 4, fontStyle: "italic", color: "var(--text)" }}>
            {voiceState.transcript} <span style={{ color: "var(--text-secondary)" }}>{voiceState.interimTranscript}</span>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {captures.length === 0 ? (
          <div class="empty-state" style={{ height: "auto", padding: "24px 16px" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
            <h3 style={{ marginBottom: 8 }}>Welcome to ContextCapture!</h3>
            <p style={{ marginBottom: 16, color: "var(--text-secondary)" }}>
              Start capturing by selecting text on the page, taking a screenshot, or adding a quick note.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, width: "100%", textAlign: "center" }}>
              <div style={{ padding: "10px 6px", background: "var(--surface)", borderRadius: 8, border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 20 }}>📝</div>
                <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4 }}>Text &amp; Notes</div>
              </div>
              <div style={{ padding: "10px 6px", background: "var(--surface)", borderRadius: 8, border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 20 }}>📸</div>
                <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4 }}>Screenshots</div>
              </div>
              <div style={{ padding: "10px 6px", background: "var(--surface)", borderRadius: 8, border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 20 }}>🔗</div>
                <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4 }}>Links &amp; Pages</div>
              </div>
            </div>
          </div>
        ) : (
          captures.map((cap) => (
            <CaptureCard
              key={cap.capture_id}
              capture={cap}
              onDelete={() => deleteCapture(cap.capture_id)}
              onViewDetail={onViewDetail}
            />
          ))
        )}
      </div>
    </div>
  );
}
