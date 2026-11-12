import { useState, useRef } from "preact/hooks";
import { projects as projRepo, captures as capRepo } from "../../data/repositories";
import { CaptureEditModal } from "./CaptureEditModal";
import { Toast } from "./Toast";

export function CaptureCard({
  capture,
  onDelete,
  onEdit,
}: {
  capture: any;
  onDelete?: () => void;
  onEdit?: () => void;
}) {
  const [currentCapture, setCurrentCapture] = useState(capture);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [availableProjects, setAvailableProjects] = useState<any[]>([]);
  const [addedMsg, setAddedMsg] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteToast, setShowDeleteToast] = useState(false);
  const deleteTimerRef = useRef<number | null>(null);

  const typeLabel = currentCapture.type.charAt(0).toUpperCase() + currentCapture.type.slice(1);
  const typeColors: Record<string, string> = {
    text: "#0071e3",
    code: "#34c759",
    link: "#5ac8fa",
    question: "#ff9500",
    note: "#bf5af2",
    screenshot: "#ff3b30",
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
        borderLeft: `3px solid ${typeColors[currentCapture.type] || "#86868b"}`,
        opacity: showDeleteToast ? 0.4 : 1,
        transition: "opacity 0.2s",
      }}
    >
      <span class="card-type-badge">{typeLabel}</span>
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
                color: "var(--warning, #ff9500)",
                fontSize: 11,
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 2,
              }}
              title="A capture with this URL already exists in your library"
            >
              ⚠ Duplicate URL
            </span>
          )}
          {addedMsg && <span style={{ color: "var(--success)", fontWeight: 600 }}>{addedMsg}</span>}
        </div>
        {currentCapture.content_text && <div class="card-text">{currentCapture.content_text}</div>}
        {currentCapture.code_language && (
          <div class="code-block">{currentCapture.content_text}</div>
        )}
        {currentCapture.user_note && (
          <div class="card-note">💬 {currentCapture.user_note}</div>
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
          <button class="btn-icon" onClick={openPicker} title="Add to Project" aria-label="Add to Project">
            + Project
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
            &#9998;
          </button>
          <button
            class="btn-icon btn-danger"
            onClick={handleDeleteClick}
            title="Delete"
            aria-label="Delete capture"
          >
            &#10007;
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
    </div>
  );
}
