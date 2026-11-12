import { useState } from "preact/hooks";
import { projects as projRepo } from "../../data/repositories";

export function CaptureCard({
  capture,
  onDelete,
  onEdit,
}: {
  capture: any;
  onDelete?: () => void;
  onEdit?: () => void;
}) {
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [availableProjects, setAvailableProjects] = useState<any[]>([]);
  const [addedMsg, setAddedMsg] = useState("");

  const typeLabel = capture.type.charAt(0).toUpperCase() + capture.type.slice(1);
  const typeColors: Record<string, string> = {
    text: "#0071e3",
    code: "#34c759",
    link: "#5ac8fa",
    question: "#ff9500",
    note: "#bf5af2",
    screenshot: "#ff3b30",
  };

  const tags: string[] = capture.tags || [];

  async function openPicker() {
    const projs = await projRepo.list();
    setAvailableProjects(projs);
    setShowProjectPicker(true);
  }

  async function addToProject(projectId: string) {
    await projRepo.addCapture(projectId, capture.capture_id);
    setShowProjectPicker(false);
    setAddedMsg("Added to project!");
    setTimeout(() => setAddedMsg(""), 2000);
  }

  return (
    <div class="card" style={{ borderLeft: `3px solid ${typeColors[capture.type] || "#86868b"}` }}>
      <span class="card-type-badge">{typeLabel}</span>
      <div class="card-content">
        <div class="card-title">
          {capture.source_url ? (
            <a href={capture.source_url} target="_blank" rel="noopener noreferrer">
              {capture.source_title || capture.content_text?.slice(0, 60) || "Untitled"}
            </a>
          ) : (
            capture.source_title || capture.content_text?.slice(0, 60) || "Untitled"
          )}
        </div>
        <div class="card-meta">
          {capture.source_domain && <span class="domain">{capture.source_domain}</span>}
          <span>{new Date(capture.created_at).toLocaleDateString()}</span>
          {addedMsg && <span style={{ color: "var(--success)", fontWeight: 600 }}>{addedMsg}</span>}
        </div>
        {capture.content_text && <div class="card-text">{capture.content_text}</div>}
        {capture.code_language && (
          <div class="code-block">{capture.content_text}</div>
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
          <button class="btn-icon" onClick={openPicker} title="Add to Project">+ Project</button>
          {onEdit && <button class="btn-icon" onClick={onEdit} title="Edit">&#9998;</button>}
          {onDelete && <button class="btn-icon btn-danger" onClick={onDelete} title="Delete">&#10007;</button>}
        </div>
      </div>
    </div>
  );
}
