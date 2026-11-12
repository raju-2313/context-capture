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
  QuestionIcon,
} from "../../components/Icons";

export default function ThisTab({ onViewDetail }: { onViewDetail?: (id: string) => void } = {}) {
  const [contextId, setContextId] = useState<string | null>(null);
  const [contextTitle, setContextTitle] = useState("New Context");
  const [captures, setCaptures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerText, setComposerText] = useState("");
  const [composerType, setComposerType] = useState<"note" | "question">("note");
  const [savingComposer, setSavingComposer] = useState(false);
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

  async function handleComposerSave() {
    if (!composerText.trim() || savingComposer) return;
    setSavingComposer(true);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (composerType === "note") {
        await capturePipeline.captureNote({
          text: composerText.trim(),
          tabId: tab?.id ?? null,
          windowId: tab?.windowId ?? null,
        });
      } else {
        await capturePipeline.captureQuestion({
          text: composerText.trim(),
          tabId: tab?.id ?? null,
          windowId: tab?.windowId ?? null,
        });
      }
      setComposerText("");
      await load();
    } catch (e) {
      console.error("Failed to save capture from composer", e);
    } finally {
      setSavingComposer(false);
    }
  }

  async function captureScreenshot() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;
    await capturePipeline.captureScreenshot({ tabId: tab.id, windowId: tab.windowId });
    await load();
  }

  async function captureBookmark() {
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

      {/* Modern Inline Composer */}
      <div class="composer-card">
        <div class="composer-header">
          <div class="composer-modes">
            <button
              class={`mode-pill ${composerType === "note" ? "active" : ""}`}
              onClick={() => setComposerType("note")}
            >
              <NoteIcon size={12} /> Note
            </button>
            <button
              class={`mode-pill ${composerType === "question" ? "active orange" : ""}`}
              onClick={() => setComposerType("question")}
            >
              <QuestionIcon size={12} /> Question
            </button>
          </div>

          <div class="composer-quick-actions">
            <button
              class="pill-action"
              onClick={captureScreenshot}
              title="Capture visible screen"
            >
              <ScreenshotIcon size={12} color="var(--ocean-blue)" /> Screen
            </button>
            <button
              class="pill-action"
              onClick={captureBookmark}
              title="Save bookmark link"
            >
              <BookmarkIcon size={12} color="var(--ocean-blue)" /> Link
            </button>
            <button
              class={`pill-action ${voiceState.isRecording ? "recording" : ""}`}
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
              title={voiceState.isRecording ? "Stop recording voice note" : "Record voice note"}
            >
              {voiceState.isRecording ? (
                <>
                  <StopIcon size={12} /> Stop
                </>
              ) : (
                <>
                  <MicIcon size={12} color="var(--sunset-orange)" /> Voice
                </>
              )}
            </button>
          </div>
        </div>

        <textarea
          class="composer-textarea"
          rows={2}
          value={composerText}
          placeholder={
            composerType === "note"
              ? "Type a thought, memo, or key insight..."
              : "What question or inquiry needs investigating?..."
          }
          onInput={(e: any) => setComposerText(e.target.value)}
          onKeyDown={(e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.preventDefault();
              handleComposerSave();
            }
          }}
        />

        <div class="composer-footer">
          <span class="composer-hint">Press ⌘/Ctrl+Enter</span>
          <button
            class="btn btn-primary"
            disabled={!composerText.trim() || savingComposer}
            onClick={handleComposerSave}
            style={{
              padding: "4px 12px",
              fontSize: 11.5,
              background: composerType === "question" ? "var(--sunset-orange)" : "var(--ocean-blue)",
              borderColor: "transparent",
            }}
          >
            {savingComposer
              ? "Saving..."
              : composerType === "question"
              ? "Ask Question"
              : "Add Note"}
          </button>
        </div>
      </div>

      {voiceState.isRecording && (
        <div
          style={{
            padding: "8px 12px",
            background: "var(--sunset-orange-subtle)",
            border: "1px solid var(--sunset-orange)",
            borderRadius: 8,
            marginBottom: 10,
            fontSize: 12,
          }}
        >
          <div style={{ fontWeight: 600, color: "var(--sunset-orange)", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--sunset-orange)", display: "inline-block" }}></span>
            Recording Voice Note...
          </div>
          <div style={{ marginTop: 4, fontStyle: "italic", color: "var(--text)" }}>
            {voiceState.transcript} <span style={{ color: "var(--text-secondary)" }}>{voiceState.interimTranscript}</span>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {captures.length === 0 ? (
          <div class="empty-state" style={{ height: "auto", padding: "28px 16px" }}>
            <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}>
              <NoteIcon size={36} color="var(--ocean-blue)" />
            </div>
            <h3 style={{ marginBottom: 8, color: "#ffffff" }}>Active Tab Context</h3>
            <p style={{ marginBottom: 16, color: "var(--text-secondary)", fontSize: 12 }}>
              Select text on any webpage to use the Ask pill, take a screenshot, or type in the composer above.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, width: "100%", textAlign: "center" }}>
              <div style={{ padding: "12px 6px", background: "var(--surface)", borderRadius: 8, border: "1px solid var(--border)", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <TextIcon size={20} color="var(--sunset-orange)" />
                <div style={{ fontSize: 11, fontWeight: 600 }}>Text &amp; Notes</div>
              </div>
              <div style={{ padding: "12px 6px", background: "var(--surface)", borderRadius: 8, border: "1px solid var(--border)", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <ScreenshotIcon size={20} color="var(--ocean-blue)" />
                <div style={{ fontSize: 11, fontWeight: 600 }}>Screenshots</div>
              </div>
              <div style={{ padding: "12px 6px", background: "var(--surface)", borderRadius: 8, border: "1px solid var(--border)", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <BookmarkIcon size={20} color="var(--ocean-blue)" />
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
