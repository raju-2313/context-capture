import { useState, useEffect } from "preact/hooks";
import { capturePipeline } from "../../../core/capture/pipeline";
import { contextLifecycle } from "../../../core/context/lifecycle";
import { captures as capRepo, contexts as ctxRepo } from "../../../data/repositories";
import { CaptureCard } from "../../components/CaptureCard";
import { voiceNoteIntegration, VoiceRecordingState } from "../../../core/integrations/voice";
import {
  ScreenshotIcon,
  TextIcon,
  NoteIcon,
  BookmarkIcon,
  MicIcon,
  StopIcon,
} from "../../components/Icons";

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
        <button class="btn btn-primary" onClick={captureScreenshot} title="Capture visible screen" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <ScreenshotIcon size={13} color="var(--color-rare, #ED4059)" /> Screenshot
        </button>
        <button class="btn" onClick={() => {
          const t = prompt("Enter text to capture:");
          if (t) captureText(t);
        }} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <TextIcon size={13} color="var(--color-highlight, #C6E354)" /> Text
        </button>
        <button class="btn" onClick={() => {
          const t = prompt("Enter a note:");
          if (t) capturePipeline.captureNote({ text: t, tabId: null, windowId: null }).then(() => load());
        }} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <NoteIcon size={13} color="var(--color-primary, #4D59E3)" /> Note
        </button>
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
        }} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <BookmarkIcon size={13} color="var(--color-primary, #4D59E3)" /> Bookmark
        </button>
        <button
          class="btn"
          style={{
            background: voiceState.isRecording ? "var(--color-rare, #ED4059)" : "var(--muted)",
            color: voiceState.isRecording ? "#ffffff" : "inherit",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
          }}
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
          {voiceState.isRecording ? (
            <>
              <StopIcon size={13} /> Stop
            </>
          ) : (
            <>
              <MicIcon size={13} color="var(--color-highlight, #C6E354)" /> Voice
            </>
          )}
        </button>
      </div>

      {voiceState.isRecording && (
        <div
          style={{
            padding: "8px 12px",
            background: "var(--rare-subtle)",
            border: "1px solid var(--color-rare, #ED4059)",
            borderRadius: 8,
            marginBottom: 10,
            fontSize: 12,
          }}
        >
          <div style={{ fontWeight: 600, color: "var(--color-rare, #ED4059)", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-rare, #ED4059)", display: "inline-block" }}></span>
            Recording Voice Note...
          </div>
          <div style={{ marginTop: 4, fontStyle: "italic", color: "var(--text)" }}>
            {voiceState.transcript} <span style={{ color: "var(--text-secondary)" }}>{voiceState.interimTranscript}</span>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {captures.length === 0 ? (
          <div class="empty-state" style={{ height: "auto", padding: "24px 16px" }}>
            <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}>
              <NoteIcon size={36} color="var(--color-primary, #4D59E3)" />
            </div>
            <h3 style={{ marginBottom: 8, color: "var(--color-neutral, #F6F6F6)" }}>Welcome to ContextCapture</h3>
            <p style={{ marginBottom: 16, color: "var(--text-secondary)" }}>
              Start capturing by selecting text on any page, taking a screenshot, or adding a quick note.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, width: "100%", textAlign: "center" }}>
              <div style={{ padding: "12px 6px", background: "var(--surface)", borderRadius: 8, border: "1px solid var(--border)", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <TextIcon size={20} color="var(--color-highlight, #C6E354)" />
                <div style={{ fontSize: 11, fontWeight: 600 }}>Text &amp; Notes</div>
              </div>
              <div style={{ padding: "12px 6px", background: "var(--surface)", borderRadius: 8, border: "1px solid var(--border)", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <ScreenshotIcon size={20} color="var(--color-rare, #ED4059)" />
                <div style={{ fontSize: 11, fontWeight: 600 }}>Screenshots</div>
              </div>
              <div style={{ padding: "12px 6px", background: "var(--surface)", borderRadius: 8, border: "1px solid var(--border)", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <BookmarkIcon size={20} color="var(--color-primary, #4D59E3)" />
                <div style={{ fontSize: 11, fontWeight: 600 }}>Links &amp; Pages</div>
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
