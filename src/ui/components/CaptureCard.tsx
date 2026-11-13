import { useState, useRef, useEffect } from "preact/hooks";
import { projects as projRepo, captures as capRepo, attachments as attRepo } from "../../data/repositories";
import { CaptureEditModal } from "./CaptureEditModal";
import { ConfirmModal } from "./ConfirmModal";
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

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
    });
  } catch { return ""; }
}

export function CaptureCard({
  capture,
  onDelete,
  onEdit,
  onViewDetail,
  selected = false,
  onToggleSelect,
  showCheckbox = false,
}: {
  capture: any;
  onDelete?: () => void;
  onEdit?: () => void;
  onViewDetail?: (captureId: string) => void;
  selected?: boolean;
  onToggleSelect?: (captureId: string) => void;
  showCheckbox?: boolean;
}) {
  const [currentCapture, setCurrentCapture] = useState(capture);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [availableProjects, setAvailableProjects] = useState<any[]>([]);
  const [addedMsg, setAddedMsg] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [showFullImageModal, setShowFullImageModal] = useState(false);

  useEffect(() => { setCurrentCapture(capture); }, [capture]);

  useEffect(() => {
    let active = true;
    let url: string | null = null;
    if (currentCapture.type === "screenshot") {
      setImageLoading(true);
      (async () => {
        try {
          let blob: Blob | null = null;
          if (currentCapture.attachment_ids?.length > 0) {
            const att = await attRepo.get(currentCapture.attachment_ids[0]);
            blob = att?.blob || att?.data_blob || null;
          }
          if (!blob) {
            const atts = await attRepo.getAttachmentsForCapture(currentCapture.capture_id);
            blob = atts?.[0]?.blob || atts?.[0]?.data_blob || null;
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
      if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
    };
  }, [currentCapture.capture_id, currentCapture.type]);

  const tags: string[] = currentCapture.tags || [];
  const typeLabel = (currentCapture.type as string).toUpperCase();

  async function openPicker() {
    const projs = await projRepo.list();
    setAvailableProjects(projs);
    setShowProjectPicker(true);
  }

  async function addToProject(projectId: string) {
    await projRepo.addCapture(projectId, currentCapture.capture_id);
    setShowProjectPicker(false);
    setAddedMsg("Added!");
    setTimeout(() => setAddedMsg(""), 2000);
  }

  function handleDeleteClick(e: MouseEvent) {
    e.stopPropagation();
    setShowConfirmDelete(true);
  }

  async function handleConfirmPermanentDelete() {
    setDeleting(true);
    try {
      await capRepo.permanentDelete(currentCapture.capture_id);
      setShowConfirmDelete(false);
      if (onDelete) onDelete();
    } catch (err) {
      console.error("Failed to delete capture", err);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div class="cc-card">
      {/* ── Type Banner with Selection Checkbox ── */}
      <div class="cc-card-banner">
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          {(showCheckbox || onToggleSelect) && (
            <input
              type="checkbox"
              class="item-checkbox"
              checked={selected}
              onChange={(e) => {
                e.stopPropagation();
                if (onToggleSelect) onToggleSelect(currentCapture.capture_id);
              }}
              aria-label={`Select capture ${currentCapture.capture_id}`}
            />
          )}
          <span>{typeLabel}</span>
        </div>
      </div>

      {/* ── Card Body ── */}
      <div class="cc-card-body">
        {/* Title */}
        <div class="cc-card-title">
          {currentCapture.source_url ? (
            <a href={currentCapture.source_url} target="_blank" rel="noopener noreferrer">
              {currentCapture.source_title || currentCapture.content_text?.slice(0, 80) || "Untitled"}
            </a>
          ) : (
            currentCapture.source_title || currentCapture.content_text?.slice(0, 80) || "Untitled"
          )}
        </div>

        {/* Domain */}
        {currentCapture.source_domain && (
          <div class="cc-card-domain">
            {currentCapture.favicon_url && (
              <img
                src={currentCapture.favicon_url}
                alt=""
                width={12} height={12}
                style={{ verticalAlign: "middle", borderRadius: 2 }}
                onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none"; }}
              />
            )}
            {currentCapture.source_domain}
          </div>
        )}

        {/* Text preview */}
        {currentCapture.content_text && currentCapture.type !== "link" && (
          <div class="cc-card-text">
            {currentCapture.code_language
              ? <code class="cc-card-code">{currentCapture.content_text}</code>
              : currentCapture.content_text}
          </div>
        )}

        {/* Screenshot */}
        {currentCapture.type === "screenshot" && (
          <div class="cc-card-screenshot-wrap">
            {screenshotUrl ? (
              <div class="cc-ss-container" onClick={() => setShowFullImageModal(true)} title="Click to expand">
                <img src={screenshotUrl} alt={currentCapture.source_title || "Screenshot"} class="cc-ss-img" loading="lazy" />
                <div class="cc-ss-overlay">
                  <ExpandIcon size={12} /> Expand
                </div>
              </div>
            ) : imageLoading ? (
              <div class="cc-ss-placeholder">Loading screenshot...</div>
            ) : (
              <div class="cc-ss-placeholder">
                <ScreenshotIcon size={14} /> Screenshot saved
              </div>
            )}
          </div>
        )}

        {/* User note */}
        {currentCapture.user_note && (
          <div class="cc-card-note">
            <NoteIcon size={12} style={{ flexShrink: 0 }} />
            <span>{currentCapture.user_note}</span>
          </div>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div class="cc-card-tags">
            {tags.map((tag: string) => <span key={tag} class="cc-tag">#{tag}</span>)}
          </div>
        )}

        {/* Warnings & feedback */}
        {(currentCapture.duplicate_warning || addedMsg) && (
          <div class="cc-card-feedback">
            {currentCapture.duplicate_warning && (
              <span class="cc-dupe-warn">
                <DuplicateIcon size={11} color="var(--warning)" /> Duplicate URL
              </span>
            )}
            {addedMsg && <span class="cc-added-msg">{addedMsg}</span>}
          </div>
        )}

        {/* Project picker */}
        {showProjectPicker && (
          <div class="cc-project-picker">
            <div class="cc-project-picker-title">Add to project:</div>
            {availableProjects.length === 0 ? (
              <div class="cc-project-picker-empty">No projects yet — create one in Projects tab.</div>
            ) : (
              <div class="cc-project-picker-grid">
                {availableProjects.map((p) => (
                  <button key={p.project_id} class="cc-project-chip" onClick={() => addToProject(p.project_id)}>
                    + {p.title}
                  </button>
                ))}
              </div>
            )}
            <button class="cc-project-cancel" onClick={() => setShowProjectPicker(false)}>Cancel</button>
          </div>
        )}

        {/* ── Action Bar ── */}
        <div class="cc-card-actions">
          <div class="cc-actions-left">
            <button
              class="cc-action-btn"
              title="Copy to clipboard"
              onClick={async () => {
                const ok = await clipboardIntegration.copyFormatted(currentCapture);
                setAddedMsg(ok ? "Copied!" : "Failed");
                setTimeout(() => setAddedMsg(""), 2000);
              }}
            >
              <CopyIcon size={13} />
            </button>
            <button
              class="cc-action-btn"
              title="Send to Webhook"
              onClick={async () => {
                setAddedMsg("Sending...");
                const res = await webhookIntegration.sendCapture(currentCapture);
                setAddedMsg(res.success ? "Sent!" : (res.error || "Failed"));
                setTimeout(() => setAddedMsg(""), 2500);
              }}
            >
              <ExportIcon size={13} />
            </button>
            {onViewDetail && (
              <button class="cc-action-btn" title="View details" onClick={() => onViewDetail(currentCapture.capture_id)}>
                <SearchIcon size={13} />
              </button>
            )}
            <button class="cc-action-btn cc-action-project" onClick={openPicker} title="Add to Project">
              <PlusIcon size={11} /> Project
            </button>
            <button
              class="cc-action-btn"
              title="Edit"
              onClick={() => { if (onEdit) onEdit(); else setIsEditing(true); }}
            >
              <EditIcon size={13} />
            </button>
            <button class="cc-action-btn cc-action-danger" title="Delete" onClick={handleDeleteClick}>
              <TrashIcon size={13} color="var(--danger)" />
            </button>
          </div>
          <span class="cc-action-date">{formatDate(currentCapture.created_at)}</span>
        </div>
      </div>

      {/* Modals */}
      {isEditing && (
        <CaptureEditModal
          capture={currentCapture}
          onClose={() => setIsEditing(false)}
          onSave={(updated) => {
            setCurrentCapture({ ...currentCapture, ...updated });
            setIsEditing(false);
          }}
        />
      )}

      {showConfirmDelete && (
        <ConfirmModal
          isOpen={showConfirmDelete}
          title="Permanently Delete Capture?"
          message={`"${currentCapture.source_title || currentCapture.content_text?.slice(0, 50) || "This capture"}" will be permanently removed from your browser storage. This cannot be undone.`}
          confirmLabel={deleting ? "Deleting…" : "Permanently Delete"}
          onConfirm={handleConfirmPermanentDelete}
          onCancel={() => setShowConfirmDelete(false)}
        />
      )}

      {showFullImageModal && screenshotUrl && (
        <div class="lightbox-backdrop" onClick={() => setShowFullImageModal(false)}>
          <div class="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <div class="lightbox-header">
              <span class="lightbox-title">{currentCapture.source_title || "Screenshot"}</span>
              <button class="lightbox-close" onClick={() => setShowFullImageModal(false)}>✕</button>
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
