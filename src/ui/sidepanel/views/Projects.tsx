import { useState, useEffect } from "preact/hooks";
import { projects as projRepo, captures as capRepo } from "../../../data/repositories";
import { ProjectRecord, Capture } from "../../../shared/types";
import { CaptureCard } from "../../components/CaptureCard";
import { exportEngine } from "../../../core/export";

export default function ProjectsView() {
  const [projectList, setProjectList] = useState<ProjectRecord[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectRecord | null>(null);
  const [projectCaptures, setProjectCaptures] = useState<Capture[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      const all = await projRepo.list();
      setProjectList(all);
    } catch (e) {
      console.error("Failed to load projects", e);
    } finally {
      setLoading(false);
    }
  }

  async function openProject(p: ProjectRecord) {
    setSelectedProject(p);
    setLoading(true);
    try {
      const caps = await projRepo.listCaptures(p.project_id);
      setProjectCaptures(caps);
    } catch (e) {
      console.error("Failed to load project captures", e);
    } finally {
      setLoading(false);
    }
  }

  async function createProject() {
    if (!newTitle.trim()) return;
    const p = await projRepo.create({ title: newTitle, description: newDesc });
    setNewTitle("");
    setNewDesc("");
    setShowCreateModal(false);
    await loadProjects();
    await openProject(p);
  }

  async function removeCapture(captureId: string) {
    if (!selectedProject) return;
    await projRepo.removeCapture(selectedProject.project_id, captureId);
    const updated = await projRepo.listCaptures(selectedProject.project_id);
    setProjectCaptures(updated);
  }

  async function exportProject() {
    if (!selectedProject) return;
    const ids = projectCaptures.map((c) => c.capture_id);
    const blob = await exportEngine.exportMarkdownCaptures(ids);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedProject.title.toLowerCase().replace(/[^a-z0-9]/g, "-")}-export.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div class="empty-state">Loading projects...</div>;

  // Selected Project Detail View
  if (selectedProject) {
    return (
      <div class="container">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <button class="btn btn-icon" onClick={() => { setSelectedProject(null); loadProjects(); }}>
            &larr; All Projects
          </button>
          <button class="btn btn-primary" onClick={exportProject} disabled={projectCaptures.length === 0}>
            Export Markdown
          </button>
        </div>

        <div class="context-header" style={{ marginBottom: 16 }}>
          <div class="context-title">{selectedProject.title}</div>
          {selectedProject.description && (
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
              {selectedProject.description}
            </div>
          )}
          <div class="context-meta" style={{ marginTop: 6 }}>
            {projectCaptures.length} captures curated
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {projectCaptures.length === 0 ? (
            <div class="empty-state" style={{ height: "auto" }}>
              <p>No captures added to this project yet.</p>
              <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 6 }}>
                Open any capture in "This Tab" or "All" and click "+ Project" to add it here.
              </p>
            </div>
          ) : (
            projectCaptures.map((cap) => (
              <CaptureCard
                key={cap.capture_id}
                capture={cap}
                onDelete={() => removeCapture(cap.capture_id)}
              />
            ))
          )}
        </div>
      </div>
    );
  }

  // Projects List View
  return (
    <div class="container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ fontSize: 14 }}>Projects ({projectList.length})</h3>
        <button class="btn btn-primary" onClick={() => setShowCreateModal(!showCreateModal)}>
          {showCreateModal ? "Cancel" : "+ New Project"}
        </button>
      </div>

      {showCreateModal && (
        <div class="card" style={{ padding: 12, marginBottom: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            class="search-bar"
            placeholder="Project title (e.g. EV Battery Tech)..."
            value={newTitle}
            onInput={(e) => setNewTitle(e.currentTarget.value)}
            autoFocus
          />
          <textarea
            class="textarea"
            placeholder="Optional project purpose or description..."
            value={newDesc}
            onInput={(e) => setNewDesc(e.currentTarget.value)}
          />
          <button class="btn btn-primary" onClick={createProject} disabled={!newTitle.trim()}>
            Create Project
          </button>
        </div>
      )}

      {projectList.length === 0 ? (
        <div class="empty-state" style={{ height: "auto" }}>
          <p>No projects created yet.</p>
          <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 6 }}>
            Projects allow you to organize and curate captures across multiple tab contexts into a single topic.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {projectList.map((p) => (
            <div key={p.project_id} class="card" style={{ cursor: "pointer" }} onClick={() => openProject(p)}>
              <div class="card-content">
                <div class="card-title" style={{ color: "var(--accent)" }}>{p.title}</div>
                {p.description && (
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", margin: "4px 0" }}>
                    {p.description}
                  </div>
                )}
                <div class="card-meta">
                  <span>Created {new Date(p.created_at).toLocaleDateString()}</span>
                  <span>&bull;</span>
                  <span>Click to view curated captures &rarr;</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
