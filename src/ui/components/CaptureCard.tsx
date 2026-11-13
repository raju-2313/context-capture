import { useState, useRef, useEffect } from "preact/hooks";
import { projects as projRepo, captures as capRepo, attachments as attRepo } from "../../data/repositories";
import { CaptureEditModal } from "./CaptureEditModal";
import { Toast } from "./Toast";
import { clipboardIntegration } from "../../core/integrations/clipboard";
import { webhookIntegration } from "../../core/integrations/webhook";
import {
  CopyIcon,
  ExportIcon,
  SearchIcon,
  EditIcon,
  TrashIcon,
  PlusIcon,
  ExpandIcon,
  ScreenshotIcon,
  NoteIcon,
  DuplicateIcon,
} from "./Icons";

export function CaptureCard({
  capture,
  onDelete,
  onEdit,
  onViewDetail,
}: {
  capture: any;
  onDelete?: () => void;
  onEdit?: () => void;
  onViewDetail?: (captureId: string) => void;
}) {
  const [currentCapture, setCurrentCapture] = useState(capture);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [availableProjects, setAvailableProjects] = useState<any[]>([]);
  const [addedMsg, setAddedMsg] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteToast, setShowDeleteToast] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [showFullImageModal, setShowFullImageModal] = useState(false);
  const deleteTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setCurrentCapture(capture);
  }, [capture]);

  useEffect(() => {
    let active = true;
    let url: string | null = null;

    if (currentCapture.type === "screenshot") {
      setImageLoading(true);
      (async () => {
        try {
          let blob: Blob | null = null;
          if (currentCapture.attachment_ids && currentCapture.attachment_ids.length > 0) {
            const att = await attRepo.get(currentCapture.attachment_ids[0]);
            blob = att?.blob || att?.data_blob || null;
          }
          if (!blob) {
            const atts = await attRepo.getAttachmentsForCapture(currentCapture.capture_id);
            if (atts && atts.length > 0) {
              blob = atts[0]?.blob || atts[0]?.data_blob || null;
            }
          }
          if (blob && active) {
            url = URL.createObjectURL(blob);
            setScreenshotUrl(url);
          }
        } catch (e) {
          console.error("Failed to load capture screenshot", e);
        } finally {
          if (active) setImageLoading(false);
        }
      })();
    }

    return () => {
      active = false;
      if (url && url.startsWith("blob:")) {
        URL.revokeObjectURL(url);
      }
    };
  }, [currentCapture.capture_id, currentCapture.type]);

  const typeLabel = currentCapture.type.charAt(0).toUpperCase() + currentCapture.type.slice(1);
  const typeColors: Record<string, string> = {
    text: "var(--lime)",
    note: "var(--lime)",
    code: "var(--lime)",
    link: "var(--lime)",
    question: "var(--lime)",
    screenshot: "var(--lime)",
  };

  const tags: string[] = currentCapture.tags || [];

  async function openPicker() {
    const projs = await projRepo.list();
    setAvailableProjects(projs);
    setShowProjectPicker(true);
  }

  async function addToProject(projectId: string) {
    await projRepo.addCapture(projectId, currentCapture.capture_id);
    setShowProjectPicker(false);
    setAddedMsg("Added to project!");
    setTimeout(() => setAddedMsg(""), 2000);
  }

  function handleDeleteClick() {
    setShowDeleteToast(true);
    deleteTimerRef.current = window.setTimeout(async () => {
      setShowDeleteToast(false);
      if (onDelete) {
        onDelete();
      } else {
        await capRepo.softDelete(currentCapture.capture_id);
      }
    }, 10000);
  }

  function handleUndoDelete() {
    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
    }
    setShowDeleteToast(false);
  }

  return (
    <div
      class="card"
      style={{
        opacity: showDeleteToast ? 0.4 : 1,
        transition: "opacity 0.2s",
      }}
    >
      <span class={`card-type-badge badge-${currentCapture.type}`}>{typeLabel}</span>
      <div class="card-content">
        <div class="card-title">
          {currentCapture.source_url ? (
            <a href={currentCapture.source_url} target="_blank" rel="noopener noreferrer">
              {currentCapture.source_title || currentCapture.content_text?.slice(0, 60) || "Untitled"}
            </a>
          ) : (
            currentCapture.source_title || currentCapture.content_text?.slice(0, 60) || "Untitled"
          )}
        </div>
        <div class="card-meta">
          {currentCapture.favicon_url && (
            <img
              src={currentCapture.favicon_url}
              alt=""
              width={14}
              height={14}
              style={{ verticalAlign: "middle", marginRight: 4, borderRadius: 2 }}
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = "none";
              }}
            />
          )}
          {currentCapture.source_domain && <span class="domain">{currentCapture.source_domain}</span>}
          <span>{new Date(currentCapture.created_at).toLocaleDateString()}</span>
          {currentCapture.duplicate_warning && (
            <span
              style={{
                color: "var(--warning)",
                fontSize: 11,
                fontWeight: 650,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
              title="A capture with this URL already exists in your library"
            >
              <DuplicateIcon size={12} color="var(--warning)" /> Duplicate URL
            </span>
          )}
          {addedMsg && <span style={{ color: "var(--lime)", fontWeight: 600 }}>{addedMsg}</span>}
        </div>
        {currentCapture.content_text && <div class="card-text">{currentCapture.content_text}</div>}
        {currentCapture.code_language && (
          <div class="code-block">{currentCapture.content_text}</div>
        )}
        {currentCapture.type === "screenshot" && (
          <div class="card-screenshot-container">
            {screenshotUrl ? (
              <div
                class="card-screenshot-wrapper"
                onClick={() => setShowFullImageModal(true)}
                title="Click to inspect full screenshot"
              >
                <img
                  src={screenshotUrl}
                  alt={currentCapture.source_title || "Screenshot"}
                  class="card-screenshot-img"
                  loading="lazy"
                />
                <div class="card-screenshot-badge" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <ExpandIcon size={12} /> Expand
                </div>
              </div>
            ) : imageLoading ? (
              <div class="card-screenshot-placeholder">
                Loading screenshot...
              </div>
            ) : (
              <div class="card-screenshot-placeholder" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <ScreenshotIcon size={16} /> Screenshot saved
              </div>
            )}
          </div>
        )}
        {currentCapture.user_note && (
          <div class="card-note" style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
            <NoteIcon size={14} style={{ marginTop: 2, flexShrink: 0 }} />
            <span>{currentCapture.user_note}</span>
          </div>
        )}
        <div class="card-tags">
          {tags.map((tag: string) => (
            <span key={tag} class="tag">#{tag}</span>
          ))}
        </div>

        {showProjectPicker && (
          <div style={{ marginTop: 8, padding: 6, background: "var(--surface)", borderRadius: 6 }}>
            <div style={{ fontSize: 11, marginBottom: 4, fontWeight: 600 }}>Select Project:</div>
            {availableProjects.length === 0 ? (
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                No projects yet. Create one in the Projects tab!
              </div>
            ) : (
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {availableProjects.map((p) => (
                  <button
                    key={p.project_id}
                    class="btn"
                    style={{ fontSize: 11, padding: "2px 8px" }}
                    onClick={() => addToProject(p.project_id)}
                  >
                    + {p.title}
                  </button>
                ))}
              </div>
            )}
            <button
              class="btn"
              style={{ fontSize: 10, marginTop: 4 }}
              onClick={() => setShowProjectPicker(false)}
            >
              Cancel
            </button>
          </div>
        )}

        <div class="card-actions">
          <button
            class="btn-icon"
            onClick={async () => {
              const ok = await clipboardIntegration.copyFormatted(currentCapture);
              setAddedMsg(ok ? "Copied!" : "Copy failed");
              setTimeout(() => setAddedMsg(""), 2000);
            }}
            title="Copy formatted note to clipboard"
            aria-label="Copy capture to clipboard"
          >
            <CopyIcon size={14} />
          </button>
          <button
            class="btn-icon"
            onClick={async () => {
              setAddedMsg("Sending...");
              const res = await webhookIntegration.sendCapture(currentCapture);
              setAddedMsg(res.success ? "Sent to Webhook!" : (res.error || "Webhook failed"));
              setTimeout(() => setAddedMsg(""), 2500);
            }}
            title="Send to Webhook (Notion / Zapier / Readwise)"
            aria-label="Send capture to webhook"
          >
            <ExportIcon size={14} />
          </button>
          {onViewDetail && (
            <button
              class="btn-icon"
              onClick={() => onViewDetail(currentCapture.capture_id)}
              title="View details & related captures"
              aria-label="View capture details"
            >
              <SearchIcon size={14} />
            </button>
          )}
          <button class="btn-icon" onClick={openPicker} title="Add to Project" aria-label="Add to Project">
            <PlusIcon size={12} /> Project
          </button>
          <button
            class="btn-icon"
            onClick={() => {
              if (onEdit) onEdit();
              else setIsEditing(true);
            }}
            title="Edit"
            aria-label="Edit capture"
          >
            <EditIcon size={14} />
          </button>
          <button
            class="btn-icon btn-danger"
            onClick={handleDeleteClick}
            title="Delete"
            aria-label="Delete capture"
          >
            <TrashIcon size={14} color="var(--danger)" />
          </button>
        </div>
      </div>

      {isEditing && (
        <CaptureEditModal
          capture={currentCapture}
          onClose={() => setIsEditing(false)}
          onSave={(updated) => {
            setCurrentCapture({
              ...currentCapture,
              ...updated,
            });
            setIsEditing(false);
          }}
        />
      )}

      {showDeleteToast && (
        <Toast
          message="Capture soft-deleted."
          undoLabel="Undo"
          durationMs={10000}
          onUndo={handleUndoDelete}
          onDismiss={async () => {
            setShowDeleteToast(false);
            if (onDelete) {
              onDelete();
            } else {
              await capRepo.softDelete(currentCapture.capture_id);
            }
          }}
        />
      )}

      {showFullImageModal && screenshotUrl && (
        <div class="lightbox-backdrop" onClick={() => setShowFullImageModal(false)}>
          <div class="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <div class="lightbox-header">
              <span class="lightbox-title">{currentCapture.source_title || "Screenshot"}</span>
              <button class="lightbox-close" onClick={() => setShowFullImageModal(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <div class="lightbox-body">
              <img src={screenshotUrl} alt="Full Screenshot" class="lightbox-img" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
