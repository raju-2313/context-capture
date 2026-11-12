import { useState, useEffect } from "preact/hooks";
import { captures as capRepo, attachments as attRepo, contexts as ctxRepo } from "../../../data/repositories";
import { Capture, ContextRecord } from "../../../shared/types";
import { similarityEngine, RelatedCaptureResult } from "../../../core/search/similarity";

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

  useEffect(() => {
    setActiveCaptureId(initialCaptureId);
  }, [initialCaptureId]);

  useEffect(() => {
    loadCapture();
    return () => {
      if (screenshotUrl && screenshotUrl.startsWith("blob:")) {
        URL.revokeObjectURL(screenshotUrl);
      }
    };
  }, [activeCaptureId]);

  async function loadCapture() {
    setLoading(true);
    try {
      const cap = await capRepo.get(activeCaptureId);
      if (!cap) {
        setLoading(false);
        return;
      }
      setCapture(cap);
      setUserNote(cap.user_note || "");

      if (cap.context_id) {
        const ctx = await ctxRepo.get(cap.context_id);
        if (ctx) setContext(ctx);
      }

      let blob: Blob | null = null;
      if (cap.attachment_ids && cap.attachment_ids.length > 0) {
        const att = await attRepo.get(cap.attachment_ids[0]);
        blob = att?.blob || att?.data_blob || null;
      }
      if (!blob) {
        const atts = await attRepo.getAttachmentsForCapture(cap.capture_id);
        if (atts && atts.length > 0) {
          blob = atts[0]?.blob || atts[0]?.data_blob || null;
        }
      }
      if (blob) {
        const url = URL.createObjectURL(blob);
        setScreenshotUrl(url);
      }

      // Find related captures
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

  if (loading) {
    return <div class="empty-state">Loading capture details...</div>;
  }

  if (!capture) {
    return (
      <div class="container">
        <div class="empty-state">
          <h3>Capture not found</h3>
          {onBack && (
            <button class="btn btn-primary" onClick={onBack} style={{ marginTop: 12 }}>
              &larr; Back
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div class="container" style={{ padding: 16, overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        {onBack && (
          <button class="btn" onClick={onBack} style={{ padding: "4px 10px" }} aria-label="Back">
            &larr; Back
          </button>
        )}
        <h3 style={{ fontSize: 16, fontWeight: 600, flex: 1, margin: 0 }}>
          {capture.source_title || "Capture Detail"}
        </h3>
        <span class={`card-type-badge badge-${capture.type}`}>{capture.type}</span>
      </div>

      {screenshotUrl && (
        <div style={{ marginBottom: 16, border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
          <img
            src={screenshotUrl}
            alt="Capture Screenshot"
            style={{ width: "100%", maxHeight: 300, objectFit: "contain", display: "block", background: "#000" }}
          />
        </div>
      )}

      {capture.content_text && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase" }}>
            Content
          </label>
          {capture.code_language ? (
            <pre class="code-block" style={{ marginTop: 4 }}>
              <code>{capture.content_text}</code>
            </pre>
          ) : (
            <div
              style={{
                marginTop: 4,
                padding: 12,
                background: "var(--surface)",
                borderRadius: 8,
                border: "1px solid var(--border)",
                whiteSpace: "pre-wrap",
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              {capture.content_text}
            </div>
          )}
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase" }}>
            Personal Note
          </label>
          {noteSavedMsg && <span style={{ color: "var(--color-highlight, #C6E354)", fontSize: 11, fontWeight: 600 }}>{noteSavedMsg}</span>}
        </div>
        <textarea
          class="input"
          rows={3}
          value={userNote}
          onInput={(e) => setUserNote(e.currentTarget.value)}
          placeholder="Add your note or insight..."
          style={{ width: "100%", marginTop: 4, resize: "vertical" }}
        />
        <div style={{ marginTop: 6, display: "flex", justifyContent: "flex-end" }}>
          <button class="btn btn-primary" onClick={handleSaveNote} disabled={savingNote} style={{ padding: "4px 12px", fontSize: 12 }}>
            {savingNote ? "Saving..." : "Save Note"}
          </button>
        </div>
      </div>

      <div class="settings-section" style={{ marginTop: 8 }}>
        <h4 style={{ fontSize: 12, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 8 }}>
          Metadata
        </h4>
        {capture.source_url && (
          <div class="setting-row" style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>URL</span>
            <a
              href={capture.source_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {capture.source_url}
            </a>
          </div>
        )}
        {context && (
          <div class="setting-row" style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Context</span>
            <span style={{ fontSize: 12, fontWeight: 500 }}>{context.title}</span>
          </div>
        )}
        <div class="setting-row" style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Captured At</span>
          <span style={{ fontSize: 12 }}>{new Date(capture.created_at).toLocaleString()}</span>
        </div>
        {capture.tags && capture.tags.length > 0 && (
          <div class="setting-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Tags</span>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {capture.tags.map((t) => (
                <span key={t} class="tag">#{t}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {related.length > 0 && (
        <div class="settings-section" style={{ marginTop: 16 }}>
          <h4 style={{ fontSize: 12, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 8 }}>
            🔗 Related Captures ({related.length})
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {related.map(({ capture: rel, score, commonTerms }) => (
              <div
                key={rel.capture_id}
                class="card"
                style={{
                  cursor: "pointer",
                  margin: 0,
                  padding: 10,
                  transition: "border-color 0.15s",
                }}
                onClick={() => {
                  if (onSelectCapture) onSelectCapture(rel.capture_id);
                  else setActiveCaptureId(rel.capture_id);
                }}
                title="Click to view this related capture"
              >
                <div class="card-content">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span class="card-type-badge">{rel.type}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "var(--accent)" }}>
                      {Math.round(score * 100)}% match
                    </span>
                  </div>
                  <div class="card-title" style={{ marginTop: 4 }}>
                    {rel.source_title || rel.content_text?.slice(0, 60) || "Untitled"}
                  </div>
                  {commonTerms.length > 0 && (
                    <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>
                      Shared: {commonTerms.join(", ")}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
