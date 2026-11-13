import { useState, useEffect } from "preact/hooks";
import { projects as projRepo, captures as capRepo } from "../../../data/repositories";
import { ProjectRecord, Capture } from "../../../shared/types";
import { CaptureCard } from "../../components/CaptureCard";
import { exportEngine } from "../../../core/export";
import { PlusIcon, ExportIcon } from "../../components/Icons";

export default function ProjectsView({ onViewDetail }: { onViewDetail?: (id: string) => void } = {}) {
  const [projectList, setProjectList] = useState<ProjectRecord[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectRecord | null>(null);
  const [projectCaptures, setProjectCaptures] = useState<Capture[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadProjects(); }, []);

  async function loadProjects() {
    try { setProjectList(await projRepo.list()); }
    catch (e) { console.error("Failed to load projects", e); }
    finally { setLoading(false); }
  }

  async function openProject(p: ProjectRecord) {
    setSelectedProject(p); setLoading(true);
    try { setProjectCaptures(await projRepo.listCaptures(p.project_id)); }
    catch (e) { console.error("Failed to load project captures", e); }
    finally { setLoading(false); }
  }

  async function createProject() {
    if (!newTitle.trim()) return;
    const p = await projRepo.create({ title: newTitle, description: newDesc });
    setNewTitle(""); setNewDesc(""); setShowCreate(false);
    await loadProjects(); await openProject(p);
  }

  async function removeCapture(captureId: string) {
    if (!selectedProject) return;
    await projRepo.removeCapture(selectedProject.project_id, captureId);
    setProjectCaptures(await projRepo.listCaptures(selectedProject.project_id));
  }

  async function exportProject() {
    if (!selectedProject) return;
    const ids = projectCaptures.map((c) => c.capture_id);
    const blob = await exportEngine.exportMarkdownCaptures(ids);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedProject.title.toLowerCase().replace(/[^a-z0-9]/g, "-")}-export.md`;
    a.click(); URL.revokeObjectURL(url);
  }

  if (loading) return (
    <div class="sp-loading">
      <span class="sp-loading-dot" /><span class="sp-loading-dot" /><span class="sp-loading-dot" />
    </div>
  );

  /* ── Project Detail ── */
  if (selectedProject) {
    return (
      <div class="tt-root">
        <div class="proj-detail-header">
          <button class="cc-action-btn" style={{ gap: 4 }} onClick={() => { setSelectedProject(null); loadProjects(); }}>
            ← All Projects
          </button>
          <button
            class="tt-submit-btn"
            onClick={exportProject}
            disabled={projectCaptures.length === 0}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <ExportIcon size={13} /> Export MD
          </button>
        </div>

        <div class="cc-card-banner">{selectedProject.title.toUpperCase()}</div>
        <div class="cc-card-body" style={{ paddingTop: 10 }}>
          {selectedProject.description && (
            <p class="tt-empty-desc" style={{ textAlign: "left", maxWidth: "none", marginBottom: 4 }}>
              {selectedProject.description}
            </p>
          )}
          <div class="cc-card-domain">{projectCaptures.length} captures curated</div>
        </div>

        {projectCaptures.length === 0 ? (
          <div class="tt-empty" style={{ paddingTop: 20 }}>
            <div class="tt-ready-badge" style={{ borderStyle: "dashed" }}>No captures yet</div>
            <p class="tt-empty-desc">Open any capture in Tab or Library and click "+ Project" to add it here.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {projectCaptures.map((cap) => (
              <CaptureCard
                key={cap.capture_id}
                capture={cap}
                onDelete={() => removeCapture(cap.capture_id)}
                onViewDetail={onViewDetail}
              />
            ))}
          </div>
        )}

        <div class="tt-statusbar">
          <span class="tt-status-left"><span class="tt-status-dot" /> Sync Active</span>
          <span class="tt-status-right">v2.4</span>
        </div>
      </div>
    );
  }

  /* ── Project List ── */
  return (
    <div class="tt-root">
      <div class="proj-list-header">
        <div class="tt-context-label">
          <span class="tt-live-dot" />
          <span class="tt-context-name">PROJECTS</span>
        </div>
        <button class="tt-submit-btn" onClick={() => setShowCreate(!showCreate)} style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
          <PlusIcon size={12} /> {showCreate ? "Cancel" : "New"}
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div class="proj-create-card">
          <input
            class="lib-search-input"
            style={{ background: "transparent", border: "none", outline: "none", padding: "0 0 8px 0", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontSize: 13, width: "100%" }}
            placeholder="Project title (e.g. EV Battery Tech)..."
            value={newTitle}
            onInput={(e) => setNewTitle(e.currentTarget.value)}
            autoFocus
          />
          <textarea
            style={{ background: "transparent", border: "none", outline: "none", color: "#a1a1aa", fontSize: 12, resize: "none", width: "100%", marginTop: 8 }}
            placeholder="Optional description..."
            rows={2}
            value={newDesc}
            onInput={(e: any) => setNewDesc(e.target.value)}
          />
          <button class="tt-submit-btn" style={{ marginTop: 8, alignSelf: "flex-end" }} onClick={createProject} disabled={!newTitle.trim()}>
            Create Project
          </button>
        </div>
      )}

      {/* Project List */}
      {projectList.length === 0 ? (
        <div class="tt-empty" style={{ paddingTop: 20 }}>
          <div class="tt-ready-badge" style={{ borderStyle: "dashed" }}>No projects yet</div>
          <p class="tt-empty-desc">Projects let you curate captures across tabs into one focused topic.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {projectList.map((p) => (
            <div key={p.project_id} class="ctx-card" style={{ cursor: "pointer" }} onClick={() => openProject(p)}>
              <div class="cc-card-banner">PROJECT</div>
              <div class="cc-card-body">
                <div class="cc-card-title">{p.title}</div>
                {p.description && <div class="cc-card-domain">{p.description}</div>}
                <div class="cc-card-actions" style={{ marginTop: 6 }}>
                  <div class="cc-actions-left" />
                  <span class="cc-action-date">
                    Created {new Date(p.created_at).toLocaleDateString()} · View captures →
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div class="tt-statusbar">
        <span class="tt-status-left"><span class="tt-status-dot" /> Sync Active</span>
        <span class="tt-status-right">v2.4</span>
      </div>
    </div>
  );
}
