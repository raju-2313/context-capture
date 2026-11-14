import { useState, useEffect, useRef } from "preact/hooks";
import { capturePipeline } from "../../../core/capture/pipeline";
import { contextLifecycle } from "../../../core/context/lifecycle";
import { captures as capRepo, contexts as ctxRepo } from "../../../data/repositories";
import { CaptureCard } from "../../components/CaptureCard";
import { voiceNoteIntegration, VoiceRecordingState } from "../../../core/integrations/voice";
import { insertTranscriptAtCursor } from "../composer";
import { getActiveTab } from "../activeTab";
import { createRazorpaySubscription } from "../../../core/billing/razorpay";
import {
  ScreenshotIcon,
  BookmarkIcon,
  MicIcon,
  StopIcon,
  QuestionIcon,
} from "../../components/Icons";

const RefreshIcon = ({ spinning }: { spinning: boolean }) => (
  <svg
    width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
    style={{ animation: spinning ? "cc-spin 0.7s linear infinite" : "none", display: "block" }}
  >
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);

interface ThisTabProps {
  onViewDetail?: (id: string) => void;
  onNavigateToLibrary?: () => void;
}

export default function ThisTab({ onViewDetail, onNavigateToLibrary }: ThisTabProps = {}) {
  const [contextId, setContextId] = useState<string | null>(null);
  const [contextTitle, setContextTitle] = useState("New Context");
  const [captures, setCaptures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [composerText, setComposerText] = useState("");
  const [composerType, setComposerType] = useState<"note" | "question">("note");
  const [savingComposer, setSavingComposer] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceRecordingState>({
    isRecording: false,
    transcript: "",
    interimTranscript: "",
  });
  const [currentTabTitle, setCurrentTabTitle] = useState("");
  const [currentTabUrl, setCurrentTabUrl] = useState("");
  const titleRef = useRef<HTMLElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const composerValueRef = useRef("");
  const [voicePermissionPending, setVoicePermissionPending] = useState(false);
  const [voicePermissionGranted, setVoicePermissionGranted] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  useEffect(() => {
    load();

    const handleActivated = () => {
      voiceNoteIntegration.stopRecording();
      setVoicePermissionPending(false);
      load();
    };
    const handleUpdated = (_tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (changeInfo.status === "complete") {
        voiceNoteIntegration.stopRecording();
        load();
      }
    };
    const handleMessage = (msg: any) => {
      if (
        msg?.type === "CAPTURE_SAVED" ||
        msg?.type === "CAPTURE_DELETED" ||
        msg?.type === "CONTEXT_CHANGED" ||
        msg?.type === "CAPTURES_CHANGED"
      ) load();
    };

    chrome.tabs.onActivated.addListener(handleActivated);
    chrome.tabs.onUpdated.addListener(handleUpdated);
    chrome.runtime.onMessage.addListener(handleMessage);

    // 30-second polling fallback
    const intervalId = setInterval(() => load(), 30000);

    return () => {
      voiceNoteIntegration.stopRecording();
      chrome.tabs.onActivated.removeListener(handleActivated);
      chrome.tabs.onUpdated.removeListener(handleUpdated);
      chrome.runtime.onMessage.removeListener(handleMessage);
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const handlePermissionResult = (message: { type?: string; granted?: boolean }) => {
      if (message?.type !== "MIC_PERMISSION_RESULT") return;
      setVoicePermissionPending(false);
      if (message.granted) {
        setVoicePermissionGranted(true);
        startVoiceRecording();
      }
      else setVoiceState((state) => ({ ...state, isRecording: false, status: "error", error: "Microphone permission was denied." }));
    };
    chrome.runtime.onMessage.addListener(handlePermissionResult);
    return () => chrome.runtime.onMessage.removeListener(handlePermissionResult);
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function load() {
    try {
      const tab = await getActiveTab();
      if (!tab || tab.id == null) { setLoading(false); return; }

      setCurrentTabTitle(tab.title || "");
      setCurrentTabUrl(tab.url || "");

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
    if (contextId) await contextLifecycle.renameContext(contextId, trimmed);
  }

  async function handleComposerSave() {
    if (!composerText.trim() || savingComposer) return;
    setSavingComposer(true);
    try {
      const tab = await getActiveTab();
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
    const tab = await getActiveTab();
    if (!tab || tab.id == null) return;
    await capturePipeline.captureScreenshot({ tabId: tab.id, windowId: tab.windowId });
    await load();
  }

  async function captureBookmark() {
    const tab = await getActiveTab();
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

  function insertVoiceText(text: string) {
    const textarea = composerRef.current;
    const currentValue = composerValueRef.current;
    const insertion = insertTranscriptAtCursor(
      currentValue,
      text,
      textarea?.selectionStart ?? currentValue.length,
      textarea?.selectionEnd ?? currentValue.length,
    );
    composerValueRef.current = insertion.value;
    setComposerText(insertion.value);
    requestAnimationFrame(() => {
      if (!composerRef.current) return;
      composerRef.current.focus();
      composerRef.current.setSelectionRange(insertion.cursor, insertion.cursor);
    });
  }

  function startVoiceRecording() {
    voiceNoteIntegration.startRecording(
      (state) => setVoiceState(state),
      (finalText) => insertVoiceText(finalText),
    );
  }

  async function handleVoiceClick() {
    if (voiceState.isRecording) {
      voiceNoteIntegration.stopRecording();
      return;
    }
    if (voiceState.status === "unsupported") return;
    if (voicePermissionPending) return;
    if (voicePermissionGranted) {
      startVoiceRecording();
      return;
    }
    setVoicePermissionPending(true);
    const permissionUrl = chrome.runtime.getURL("permissions.html");
    try {
      await chrome.tabs.create({ url: permissionUrl });
    } catch {
      setVoicePermissionPending(false);
      startVoiceRecording();
    }
  }

  async function deleteCapture(id: string) {
    await capRepo.permanentDelete(id);
    try { chrome.runtime?.sendMessage?.({ type: "CAPTURE_DELETED" }); } catch {}
    await load();
  }

  async function startUpgrade() {
    if (checkoutLoading) return;
    setCheckoutLoading(true);
    setCheckoutError("");
    try {
      const checkout = await createRazorpaySubscription();
      if (!checkout.checkoutUrl) throw new Error("Razorpay did not return a hosted checkout link.");
      await chrome.tabs.create({ url: checkout.checkoutUrl });
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Could not start checkout.");
    } finally {
      setCheckoutLoading(false);
    }
  }

  function getDomain(url: string) {
    try { return new URL(url).hostname.replace("www.", ""); }
    catch { return ""; }
  }

  if (loading) return (
    <div class="sp-loading">
      <span class="sp-loading-dot" /><span class="sp-loading-dot" /><span class="sp-loading-dot" />
    </div>
  );
  if (!contextId) return <div class="empty-state"><p>No active tab detected.</p></div>;

  return (
    <div class="tt-root">

      {/* ── Section: Context Header ── */}
      <div class="tt-context-row">
        <div class="tt-context-label">
          <span class="tt-live-dot" />
          <span
            class="tt-context-name"
            contentEditable={true}
            ref={titleRef}
            onBlur={(e: any) => handleTitleChange(e.currentTarget.textContent || "")}
            onKeyDown={(e: KeyboardEvent) => {
              if (e.key === "Enter") { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); }
            }}
            title="Click to rename"
          >
            {contextTitle.toUpperCase()}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span class="tt-count-pill">
            <span class="tt-count-dot" />
            {captures.length} {captures.length === 1 ? "item" : "items"}
          </span>
          <button
            class="ctx-refresh-btn"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh tab context"
            aria-label="Refresh tab context"
          >
            <RefreshIcon spinning={refreshing} />
          </button>
        </div>
      </div>

      {/* ── Section: Composer Card ── */}
      <div class="tt-composer">
        {/* Composer Top Row: mode pills + media action pills */}
        <div class="tt-composer-top">
          <div class="tt-mode-group">
            <button
              class={`tt-mode-btn ${composerType === "note" ? "active" : ""}`}
              onClick={() => setComposerType("note")}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
              </svg>
              Note
            </button>
            <button
              class={`tt-mode-btn ${composerType === "question" ? "active" : ""}`}
              onClick={() => setComposerType("question")}
            >
              <QuestionIcon size={11} color="currentColor" />
              Question
            </button>
          </div>
          <div class="tt-media-group">
            <button class="tt-media-btn" onClick={captureScreenshot} title="Capture screen">
              <ScreenshotIcon size={11} color="currentColor" />
              Screen
            </button>
            <button class="tt-media-btn" onClick={captureBookmark} title="Save page link">
              <BookmarkIcon size={11} color="currentColor" />
              Link
            </button>
            <button
              class={`tt-media-btn ${voiceState.isRecording ? "recording" : ""} ${voiceState.status === "error" ? "error" : ""}`}
              onClick={handleVoiceClick}
              title={voiceState.isRecording ? "Stop voice input" : voiceState.status === "unsupported" ? "Voice input is unsupported" : "Start voice input"}
              aria-label={voiceState.isRecording ? "Stop voice input" : "Start voice input"}
              aria-pressed={voiceState.isRecording}
              disabled={voicePermissionPending || voiceState.status === "unsupported"}
            >
              {voiceState.isRecording ? <><StopIcon size={11} /> Stop</> : <><MicIcon size={11} color="currentColor" /> Voice</>}
            </button>
          </div>
        </div>

        {/* Textarea */}
        <textarea
          ref={composerRef}
          class="tt-textarea"
          rows={2}
          value={composerText}
          onInput={(e: any) => {
            composerValueRef.current = e.currentTarget.value;
            setComposerText(e.currentTarget.value);
          }}
          placeholder={
            composerType === "note"
              ? "Type a thought, memo, or key insight..."
              : "What question needs investigating?..."
          }
          onKeyDown={(e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.preventDefault();
              handleComposerSave();
            }
          }}
        />

        {/* Composer Footer */}
        <div class="tt-composer-footer">
          <span class="tt-hint">
            Press
            <kbd class="tt-kbd">⌘</kbd>
            <kbd class="tt-kbd">Ctrl</kbd>
            <span class="tt-kbd-plus">+</span>
            <kbd class="tt-kbd">Enter</kbd>
          </span>
          <button
            class={`tt-submit-btn ${savingComposer ? "loading" : ""}`}
            disabled={!composerText.trim() || savingComposer}
            onClick={handleComposerSave}
          >
            {savingComposer ? "Saving..." : composerType === "question" ? "Ask Question ↵" : "Add Note ↵"}
          </button>
        </div>
      </div>

      {/* Voice Recording Banner */}
      {(voiceState.isRecording || voiceState.error) && (
        <div class={`tt-voice-banner ${voiceState.error ? "error" : ""}`} role="status" aria-live="polite">
          <div class="tt-voice-top">
            <span class={`tt-live-dot ${voiceState.isRecording ? "pulse" : ""}`} />
            <span>{voiceState.error || (voiceState.status === "transcribing" ? "Transcribing audio..." : "Listening...")}</span>
          </div>
          {(voiceState.transcript || voiceState.interimTranscript) && (
            <div class="tt-voice-text">
              {voiceState.transcript}
              <span style={{ opacity: 0.6 }}>{voiceState.interimTranscript}</span>
            </div>
          )}
          {voiceState.quota && (
            <div class="tt-voice-quota">
              {voiceState.quota.remaining} of {voiceState.quota.dailyLimit} {voiceState.quota.plan} transcriptions remaining today.
              {voiceState.quota.remaining === 0 && (
                <button type="button" onClick={startUpgrade} disabled={checkoutLoading}>
                  {checkoutLoading ? "Opening checkout..." : "Upgrade with Razorpay"}
                </button>
              )}
              {checkoutError && <span>{checkoutError}</span>}
            </div>
          )}
          {voiceState.error && (
            <button class="tt-voice-dismiss" onClick={() => setVoiceState({ isRecording: false, transcript: "", interimTranscript: "", status: "idle" })}>
              Dismiss
            </button>
          )}
        </div>
      )}

      {/* ── Section: Captures or Empty State ── */}
      {captures.length === 0 ? (
        <div class="tt-empty">
          {/* Status badge */}
          <div class="tt-ready-badge">
            <span class="tt-ready-dot" />
            READY TO CAPTURE
          </div>

          {/* Instruction text */}
          <p class="tt-empty-desc">
            Select text on this webpage to pop up the{" "}
            <span class="tt-ask-pill-demo">Ask</span> pill, or trigger actions below:
          </p>

          {/* Quick action row */}
          <div class="tt-quick-row">
            <button class="tt-quick-btn" onClick={captureScreenshot}>
              <ScreenshotIcon size={13} color="currentColor" />
              Screen
            </button>
            <button class="tt-quick-btn" onClick={captureBookmark}>
              <BookmarkIcon size={13} color="currentColor" />
              Link
            </button>
            <button class="tt-quick-btn" onClick={() => setComposerType("question")}>
              <QuestionIcon size={13} color="currentColor" />
              Question
            </button>
          </div>

          {/* Active context snippet: show current tab */}
          {currentTabTitle && (
            <div class="tt-snippet-section">
              <div class="tt-snippet-header">
                <span class="tt-snippet-label">Active Context Snippet</span>
                <button
                  class="tt-snippet-link"
                  onClick={() => onNavigateToLibrary?.()}
                >
                  Explore Library ↗
                </button>
              </div>
              <div class="tt-snippet-card">
                <div class="tt-snippet-icon">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                  </svg>
                </div>
                <div class="tt-snippet-info">
                  <div class="tt-snippet-title">{currentTabTitle}</div>
                  <div class="tt-snippet-meta">
                    {getDomain(currentTabUrl)} · Auto-indexed
                  </div>
                </div>
                <div class="tt-snippet-chevron">›</div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Active context snippet header when captures exist */}
          <div class="tt-snippet-header" style={{ marginTop: 2 }}>
            <span class="tt-snippet-label">
              Active Context Snippet
            </span>
            <button
              class="tt-snippet-link"
              onClick={() => onNavigateToLibrary?.()}
            >
              Explore Library ↗
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {captures.map((cap) => (
              <CaptureCard
                key={cap.capture_id}
                capture={cap}
                onDelete={() => deleteCapture(cap.capture_id)}
                onViewDetail={onViewDetail}
              />
            ))}
          </div>
        </>
      )}

      {/* ── Bottom status bar ── */}
      <div class="tt-statusbar">
        <span class="tt-status-left">
          <span class="tt-status-dot" />
          Sync Active
        </span>
        <span class="tt-status-right">v2.4</span>
      </div>
    </div>
  );
}
