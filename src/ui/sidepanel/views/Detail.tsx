import { useState, useEffect } from "preact/hooks";
import { captures as capRepo, attachments as attRepo, contexts as ctxRepo } from "../../../data/repositories";
import { Capture, ContextRecord } from "../../../shared/types";
import { similarityEngine, RelatedCaptureResult } from "../../../core/search/similarity";
import { ConfirmModal } from "../../components/ConfirmModal";
import { TrashIcon } from "../../components/Icons";

interface CaptureDetailProps {
  captureId: string;
  onBack?: () => void;
  onSelectCapture?: (captureId: string) => void;
}

export default function CaptureDetail({ captureId: initialCaptureId, onBack, onSelectCapture }: CaptureDetailProps) {
  const [activeCaptureId, setActiveCaptureId] = useState<string>(initialCaptureId);
  const [capture, setCapture] = useState<Capture | null>(null);
  const [context, setContext] = useState<ContextRecord | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [userNote, setUserNote] = useState<string>("");
  const [savingNote, setSavingNote] = useState<boolean>(false);
  const [noteSavedMsg, setNoteSavedMsg] = useState<string>("");
  const [related, setRelated] = useState<RelatedCaptureResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { setActiveCaptureId(initialCaptureId); }, [initialCaptureId]);

  useEffect(() => {
    loadCapture();
    return () => {
      if (screenshotUrl?.startsWith("blob:")) URL.revokeObjectURL(screenshotUrl);
    };
  }, [activeCaptureId]);

  async function loadCapture() {
    setLoading(true);
    try {
      const cap = await capRepo.get(activeCaptureId);
      if (!cap) { setLoading(false); return; }
      setCapture(cap);
      setUserNote(cap.user_note || "");

      if (cap.context_id) {
        const ctx = await ctxRepo.get(cap.context_id);
        if (ctx) setContext(ctx);
      }

      let blob: Blob | null = null;
      if (cap.attachment_ids?.length > 0) {
        const att = await attRepo.get(cap.attachment_ids[0]);
        blob = att?.blob || att?.data_blob || null;
      }
      if (!blob) {
        const atts = await attRepo.getAttachmentsForCapture(cap.capture_id);
        blob = atts?.[0]?.blob || atts?.[0]?.data_blob || null;
      }
      if (blob) setScreenshotUrl(URL.createObjectURL(blob));

      similarityEngine.findRelated(activeCaptureId, 4).then(setRelated).catch(() => {});
    } catch (e) {
      console.error("Failed to load capture detail", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveNote() {
    if (!capture) return;
    setSavingNote(true);
    await capRepo.update(capture.capture_id, {
      user_note: userNote.trim() || null,
      updated_at: new Date().toISOString(),
    });
    setSavingNote(false);
    setNoteSavedMsg("Saved!");
    setTimeout(() => setNoteSavedMsg(""), 2000);
  }

  function copyUrl() {
    if (!capture?.source_url) return;
    navigator.clipboard.writeText(capture.source_url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  if (loading) return (
    <div class="sp-loading">
      <span class="sp-loading-dot" /><span class="sp-loading-dot" /><span class="sp-loading-dot" />
    </div>
  );

  if (!capture) return (
    <div class="tt-root">
      <div class="tt-empty">
        <div class="tt-ready-badge" style={{ borderStyle: "dashed" }}>Capture not found</div>
        {onBack && <button class="cc-action-btn" onClick={onBack}>← Back</button>}
      </div>
    </div>
  );

  async function handlePermanentDelete() {
    setDeleting(true);
    try {
      await capRepo.permanentDelete(activeCaptureId);
      try { chrome.runtime?.sendMessage?.({ type: "CAPTURE_DELETED" }); } catch {}
      setShowConfirmDelete(false);
      if (onBack) onBack();
    } catch (err) {
      console.error("Failed to delete capture", err);
    } finally {
      setDeleting(false);
    }
  }

  const typeLabel = (capture.type as string).toUpperCase();

  return (
    <div class="tt-root">

      {/* ── Top Nav: Back + Delete + Type Badge ── */}
      <div class="det-topbar">
        {onBack && (
          <button class="det-back-btn" onClick={onBack} aria-label="Go back">
            ← Back
          </button>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            class="cc-action-btn cc-action-danger"
            onClick={() => setShowConfirmDelete(true)}
            title="Permanently delete capture"
            style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px" }}
          >
            <TrashIcon size={12} color="var(--danger)" /> Delete
          </button>
          <span class="det-type-badge">{typeLabel}</span>
        </div>
      </div>

      {/* ── Title & Domain ── */}
      <div class="det-hero">
        <h2 class="det-title">
          {capture.source_title || capture.content_text?.slice(0, 80) || "Untitled Capture"}
        </h2>
        {capture.source_domain && (
          <div class="det-domain">
            {capture.favicon_url && (
              <img
                src={capture.favicon_url}
                alt=""
                width={13} height={13}
                style={{ borderRadius: 2 }}
                onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none"; }}
              />
            )}
            {capture.source_domain}
          </div>
        )}
      </div>

      {/* ── Screenshot ── */}
      {screenshotUrl && (
        <div class="det-screenshot">
          <img src={screenshotUrl} alt={capture.source_title || "Screenshot"} class="det-screenshot-img" />
        </div>
      )}

      {/* ── Capture Preview ── */}
      {capture.content_text && (
        <div class="det-section">
          <div class="det-section-label">Capture Preview</div>
          {capture.code_language ? (
            <pre class="det-code-block"><code>{capture.content_text}</code></pre>
          ) : (
            <div class="det-preview-box">
              {capture.content_text.length === 0
                ? <span class="det-preview-empty">No preview text available for <strong>this item.</strong></span>
                : capture.content_text}
            </div>
          )}
        </div>
      )}

      {/* Show empty preview state for link types with no text */}
      {!capture.content_text && capture.type !== "screenshot" && (
        <div class="det-section">
          <div class="det-section-label">Capture Preview</div>
          <div class="det-preview-box">
            <span class="det-preview-empty">No preview text available for <strong>this item.</strong></span>
          </div>
        </div>
      )}

      {/* ── Personal Note ── */}
      <div class="det-section">
        <div class="det-section-label">
          Personal Note
          {noteSavedMsg && <span class="det-saved-msg">{noteSavedMsg}</span>}
        </div>
        <div class="det-note-card">
          <textarea
            class="det-note-textarea"
            rows={4}
            value={userNote}
            onInput={(e) => setUserNote(e.currentTarget.value)}
            placeholder="Add your note or insight..."
          />
          <div class="det-note-footer">
            <span class="det-char-count">{userNote.length} characters</span>
            <button class="det-save-btn" onClick={handleSaveNote} disabled={savingNote}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
              </svg>
              {savingNote ? "Saving..." : "Save Note"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Metadata ── */}
      <div class="det-section">
        <div class="det-section-label">Metadata</div>
        <div class="det-meta-table">
          {capture.source_url && (
            <div class="det-meta-row">
              <span class="det-meta-key">URL</span>
              <div class="det-meta-val det-url-row">
                <a href={capture.source_url} target="_blank" rel="noopener noreferrer" class="det-url-link">
                  {capture.source_url}
                </a>
                <button class="det-copy-url" onClick={copyUrl} title="Copy URL">
                  {copied ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
          )}
          {context && (
            <div class="det-meta-row">
              <span class="det-meta-key">Context</span>
              <span class="det-meta-badge">{context.title}</span>
            </div>
          )}
          <div class="det-meta-row">
            <span class="det-meta-key">Captured At</span>
            <span class="det-meta-val det-date">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              {new Date(capture.created_at).toLocaleString("en-US", {
                month: "numeric", day: "numeric", year: "numeric",
                hour: "numeric", minute: "2-digit", hour12: true
              })}
            </span>
          </div>
          {capture.tags && capture.tags.length > 0 && (
            <div class="det-meta-row">
              <span class="det-meta-key">Tags</span>
              <div class="det-meta-val" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {capture.tags.map((t) => <span key={t} class="cc-tag">#{t}</span>)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Related Captures ── */}
      {related.length > 0 && (
        <div class="det-section">
          <div class="det-section-label">Related Captures</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {related.map(({ capture: rel, score, commonTerms }) => (
              <div
                key={rel.capture_id}
                class="det-related-card"
                onClick={() => {
                  if (onSelectCapture) onSelectCapture(rel.capture_id);
                  else setActiveCaptureId(rel.capture_id);
                }}
              >
                <div class="det-related-top">
                  <span class="det-type-badge" style={{ fontSize: 9 }}>{rel.type.toUpperCase()}</span>
                  <span class="det-match-pct">{Math.round(score * 100)}% match</span>
                </div>
                <div class="det-related-title">
                  {rel.source_title || rel.content_text?.slice(0, 60) || "Untitled"}
                </div>
                {commonTerms.length > 0 && (
                  <div class="det-related-shared">Shared: {commonTerms.join(", ")}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Confirmation Modal ── */}
      <ConfirmModal
        isOpen={showConfirmDelete}
        title="Permanently Delete Capture?"
        message={`"${capture.source_title || capture.content_text?.slice(0, 50) || "This capture"}" will be permanently removed from your browser storage. This action cannot be undone.`}
        confirmLabel={deleting ? "Deleting…" : "Permanently Delete"}
        onConfirm={handlePermanentDelete}
        onCancel={() => setShowConfirmDelete(false)}
      />

      {/* ── Status Bar ── */}
      <div class="tt-statusbar">
        <span class="tt-status-left"><span class="tt-status-dot" /> Cloud Sync Connected</span>
        <span class="tt-status-right">v2.4 Pro</span>
      </div>

    </div>
  );
}
