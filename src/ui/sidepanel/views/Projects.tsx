import { useState, useEffect } from "preact/hooks";
import { projects as projRepo, captures as capRepo, contexts as ctxRepo } from "../../../data/repositories";
import { contextLifecycle } from "../../../core/context/lifecycle";
import { ProjectRecord, Capture } from "../../../shared/types";
import { CaptureCard } from "../../components/CaptureCard";
import { exportEngine } from "../../../core/export";
import { PlusIcon, ExportIcon, EditIcon, FolderIcon, TrashIcon } from "../../components/Icons";
import { ConfirmModal } from "../../components/ConfirmModal";

const LayersIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);

const RefreshIcon = ({ spinning }: { spinning: boolean }) => (
  <svg
    width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
    style={{ animation: spinning ? "cc-spin 0.7s linear infinite" : "none", display: "block" }}
  >
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);

const ACCENT_COLORS = [
  { name: "Lime", hex: "#DFFF00" },
  { name: "Blue", hex: "#38bdf8" },
  { name: "Purple", hex: "#a855f7" },
  { name: "Red", hex: "#f43f5e" },
  { name: "Emerald", hex: "#10b981" },
];

export default function ProjectsView({ onViewDetail }: { onViewDetail?: (id: string) => void } = {}) {
  const [projectList, setProjectList] = useState<ProjectRecord[]>([]);
  const [projectCounts, setProjectCounts] = useState<Record<string, number>>({});
  const [selectedProject, setSelectedProject] = useState<ProjectRecord | null>(null);
  const [projectCaptures, setProjectCaptures] = useState<Capture[]>([]);
  const [loading, setLoading] = useState(true);

  // Batch selection state
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [singleDeleteProjectTarget, setSingleDeleteProjectTarget] = useState<ProjectRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newAccent, setNewAccent] = useState("#DFFF00");

  // Inline edit state
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Add context/captures modal state
  const [modalProject, setModalProject] = useState<ProjectRecord | null>(null);
  const [activeTabContext, setActiveTabContext] = useState<{ id: string; title: string; count: number } | null>(null);
  const [libraryContexts, setLibraryContexts] = useState<Array<{ id: string; title: string; count: number }>>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();

    const handleMsg = (msg: any) => {
      if (
        msg?.type === "CAPTURE_SAVED" ||
        msg?.type === "CAPTURE_DELETED" ||
        msg?.type === "CAPTURES_CHANGED"
      ) {
        loadProjects();
      }
    };
    chrome.runtime.onMessage.addListener(handleMsg);

    // 30-second polling fallback
    const intervalId = setInterval(() => loadProjects(), 30000);

    return () => {
      chrome.runtime.onMessage.removeListener(handleMsg);
      clearInterval(intervalId);
    };
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    await loadProjects();
    setRefreshing(false);
  }

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  }

  async function loadProjects() {
    try {
      const list = await projRepo.list();
      setProjectList(list);

      const counts: Record<string, number> = {};
      await Promise.all(
        list.map(async (p) => {
          const caps = await projRepo.listCaptures(p.project_id);
          counts[p.project_id] = caps.length;
        })
      );
      setProjectCounts(counts);
    } catch (e) {
      console.error("Failed to load projects", e);
    } finally {
      setLoading(false);
    }
  }

  function toggleSelectProject(projectId: string) {
    setSelectedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  function toggleSelectAllProjects() {
    const allIds = projectList.map((p) => p.project_id);
    const areAllSelected = allIds.length > 0 && allIds.every((id) => selectedProjects.has(id));

    setSelectedProjects((prev) => {
      const next = new Set(prev);
      if (areAllSelected) {
        for (const id of allIds) next.delete(id);
      } else {
        for (const id of allIds) next.add(id);
      }
      return next;
    });
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
    const p = await projRepo.create({
      title: newTitle,
      description: newDesc,
      accent_color: newAccent,
    });
    setNewTitle("");
    setNewDesc("");
    setNewAccent("#DFFF00");
    setShowCreate(false);
    showToast(`✓ Project "${p.title}" created`);
    await loadProjects();
  }

  async function startEditing(p: ProjectRecord, e: Event) {
    e.stopPropagation();
    setEditingProjectId(p.project_id);
    setEditTitle(p.title);
    setEditDesc(p.description || "");
  }

  async function saveEditing(projectId: string) {
    if (!editTitle.trim()) return;
    await projRepo.update(projectId, {
      title: editTitle.trim(),
      description: editDesc.trim() || null,
    });
    setEditingProjectId(null);
    showToast("✓ Project updated");
    await loadProjects();
    if (selectedProject?.project_id === projectId) {
      const updated = await projRepo.get(projectId);
      if (updated) setSelectedProject(updated);
    }
  }

  async function handlePermanentDeleteSingle() {
    if (!singleDeleteProjectTarget) return;
    setDeleting(true);
    try {
      await projRepo.permanentDelete(singleDeleteProjectTarget.project_id);
      const isViewingDeleted = selectedProject?.project_id === singleDeleteProjectTarget.project_id;
      setSingleDeleteProjectTarget(null);
      if (isViewingDeleted) setSelectedProject(null);
      await loadProjects();
      showToast("✓ Project permanently deleted");
    } catch (err) {
      console.error("Failed to delete project", err);
    } finally {
      setDeleting(false);
    }
  }

  async function handlePermanentDeleteBatch() {
    if (selectedProjects.size === 0) return;
    setDeleting(true);
    try {
      await projRepo.permanentDeleteMany(Array.from(selectedProjects));
      setShowBatchDeleteConfirm(false);
      setSelectedProjects(new Set());
      await loadProjects();
      showToast("✓ Selected projects permanently deleted");
    } catch (err) {
      console.error("Failed to batch delete projects", err);
    } finally {
      setDeleting(false);
    }
  }

  async function removeCapture(captureId: string) {
    if (!selectedProject) return;
    await projRepo.removeCapture(selectedProject.project_id, captureId);
    const updated = await projRepo.listCaptures(selectedProject.project_id);
    setProjectCaptures(updated);
    setProjectCounts((prev) => ({ ...prev, [selectedProject.project_id]: updated.length }));
    showToast("Capture removed from project");
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

  /* ── Add Context / Captures Modal ── */
  async function openAddModal(p: ProjectRecord, e?: Event) {
    if (e) e.stopPropagation();
    setModalProject(p);

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id && tab?.windowId) {
        try {
          const cid = await contextLifecycle.getOrCreateForTab(tab.id, tab.windowId);
          const ctx = await ctxRepo.get(cid);
          const caps = await capRepo.listByContext(cid);
          setActiveTabContext({
            id: cid,
            title: ctx?.title || tab.title || "Current Tab",
            count: caps.length,
          });
        } catch {
          setActiveTabContext(null);
        }
      } else {
        setActiveTabContext(null);
      }

      const allCtxs = await ctxRepo.list({ status: "active" });
      const ctxsWithCounts = await Promise.all(
        allCtxs.map(async (c: any) => {
          const caps = await capRepo.listByContext(c.context_id);
          return { id: c.context_id, title: c.title || "Untitled Context", count: caps.length };
        })
      );
      setLibraryContexts(ctxsWithCounts);
    } catch (err) {
      console.error("Failed to load context choices", err);
    }
  }

  async function addContextToProject(contextId: string, contextTitle: string) {
    if (!modalProject) return;
    try {
      const caps = await capRepo.listByContext(contextId);
      if (caps.length === 0) {
        showToast(`No captures found in "${contextTitle}"`);
        return;
      }
      let added = 0;
      for (const c of caps) {
        await projRepo.addCapture(modalProject.project_id, c.capture_id);
        added++;
      }
      const memberships = await projRepo.listMemberships(modalProject.project_id);
      setProjectCounts((prev) => ({ ...prev, [modalProject.project_id]: memberships.length }));
      if (selectedProject?.project_id === modalProject.project_id) {
        setProjectCaptures(await projRepo.listCaptures(modalProject.project_id));
      }
      showToast(`✓ Added ${added} captures from "${contextTitle}"`);
    } catch (err) {
      console.error("Failed to add context captures", err);
    }
  }

  if (loading) {
    return (
      <div class="sp-loading">
        <span class="sp-loading-dot" />
        <span class="sp-loading-dot" />
        <span class="sp-loading-dot" />
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     PROJECT DETAIL VIEW (When user clicked "View Captures")
     ═══════════════════════════════════════════════════════════ */
  if (selectedProject) {
    const bannerColor = selectedProject.accent_color || "#DFFF00";
    return (
      <div class="tt-root">
        {/* Top nav */}
        <div class="proj-header" style={{ marginBottom: 12 }}>
          <button
            class="proj-cancel-btn"
            onClick={() => {
              setSelectedProject(null);
              loadProjects();
            }}
          >
            ← All Projects
          </button>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              class="proj-new-btn"
              onClick={(e) => openAddModal(selectedProject, e)}
              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <PlusIcon size={12} /> Add Context
            </button>
            <button
              class="proj-cancel-btn"
              onClick={exportProject}
              disabled={projectCaptures.length === 0}
              style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
            >
              <ExportIcon size={12} /> Export MD
            </button>
            <button
              class="proj-cancel-btn cc-action-danger"
              onClick={() => setSingleDeleteProjectTarget(selectedProject)}
              title="Permanently delete project"
              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <TrashIcon size={12} color="var(--danger)" /> Delete
            </button>
          </div>
        </div>

        {/* Project Hero Banner */}
        <div class="proj-card-banner" style={{ background: bannerColor }}>
          <span class="proj-card-banner-title">{selectedProject.title.toUpperCase()}</span>
          <span class="proj-card-banner-items">{projectCaptures.length} items</span>
        </div>

        <div class="proj-card-body" style={{ background: "#0d0d10", border: "1px solid rgba(255,255,255,0.08)", borderTop: "none", borderRadius: "0 0 10px 10px", marginBottom: 16 }}>
          {selectedProject.description && (
            <p class="proj-card-desc" style={{ marginBottom: 6 }}>
              {selectedProject.description}
            </p>
          )}
          <span style={{ fontSize: 11, color: "var(--lime)", fontWeight: 600 }}>
            Curated research workspace
          </span>
        </div>

        {/* Captures in this project */}
        {projectCaptures.length === 0 ? (
          <div class="tt-empty" style={{ paddingTop: 20 }}>
            <div class="tt-ready-badge" style={{ borderStyle: "dashed" }}>No captures in project</div>
            <p class="tt-empty-desc">
              Click <strong>"+ Add Context"</strong> above to import captures from your active tab or saved library contexts.
            </p>
            <button
              class="proj-new-btn"
              style={{ marginTop: 12 }}
              onClick={(e) => openAddModal(selectedProject, e)}
            >
              <PlusIcon size={12} /> Import from Tab or Library
            </button>
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

        {/* Add Context / Captures Modal */}
        {modalProject && (
          <div class="proj-modal-overlay" onClick={() => setModalProject(null)}>
            <div class="proj-modal" onClick={(e) => e.stopPropagation()}>
              <div class="proj-modal-header">
                <div>
                  <div class="proj-modal-title">Add to {modalProject.title}</div>
                  <div class="proj-modal-subtitle">Import captures from active tab or your research library</div>
                </div>
                <button class="proj-modal-close" onClick={() => setModalProject(null)}>✕</button>
              </div>

              {activeTabContext && (
                <div>
                  <div class="proj-modal-section-title">ACTIVE TAB CONTEXT</div>
                  <div class="proj-modal-item">
                    <div class="proj-modal-item-info">
                      <span class="proj-modal-item-name">⚡ {activeTabContext.title}</span>
                      <span class="proj-modal-item-meta">{activeTabContext.count} captures available on active tab</span>
                    </div>
                    <button
                      class="proj-modal-add-btn"
                      onClick={() => addContextToProject(activeTabContext.id, activeTabContext.title)}
                    >
                      <PlusIcon size={11} /> Add Context
                    </button>
                  </div>
                </div>
              )}

              <div>
                <div class="proj-modal-section-title">SAVED LIBRARY CONTEXTS</div>
                {libraryContexts.length === 0 ? (
                  <div style={{ fontSize: 11.5, color: "#71717a", padding: "8px 0" }}>
                    No other saved contexts found in library.
                  </div>
                ) : (
                  libraryContexts.map((ctx) => (
                    <div key={ctx.id} class="proj-modal-item">
                      <div class="proj-modal-item-info">
                        <span class="proj-modal-item-name">{ctx.title}</span>
                        <span class="proj-modal-item-meta">{ctx.count} captures</span>
                      </div>
                      <button
                        class="proj-modal-add-btn"
                        onClick={() => addContextToProject(ctx.id, ctx.title)}
                      >
                        <PlusIcon size={11} /> Add Context
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal for Single Project */}
        {singleDeleteProjectTarget && (
          <ConfirmModal
            isOpen={!!singleDeleteProjectTarget}
            title={`Permanently Delete "${singleDeleteProjectTarget.title}"?`}
            message="This project workspace and all its memberships will be permanently deleted. (Note: original captures remain in your library.)"
            confirmLabel={deleting ? "Deleting…" : "Permanently Delete"}
            onConfirm={handlePermanentDeleteSingle}
            onCancel={() => setSingleDeleteProjectTarget(null)}
          />
        )}

        {/* Toast Feedback */}
        {toastMessage && <div class="proj-toast">{toastMessage}</div>}

        {/* Statusbar */}
        <div class="tt-statusbar">
          <span class="tt-status-left"><span class="tt-status-dot" /> Cloud Sync Connected</span>
          <span class="tt-status-right">v2.4 Pro</span>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     PROJECT LIST VIEW (Matching Reference Screenshot)
     ═══════════════════════════════════════════════════════════ */
  const areAllProjectsSelected = projectList.length > 0 && projectList.every((p) => selectedProjects.has(p.project_id));

  return (
    <div class="tt-root">
      {/* ── Header ─────────────────────────────────────────── */}
      <div class="proj-header">
        <div class="proj-title-wrap">
          <span class="proj-live-dot" />
          <span class="proj-title-text">PROJECTS</span>
          <span class="proj-count-badge">{projectList.length}</span>

          {projectList.length > 0 && (
            <label style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer", marginLeft: 6 }}>
              <input
                type="checkbox"
                class="item-checkbox"
                checked={areAllProjectsSelected}
                onChange={toggleSelectAllProjects}
                title="Select all projects"
              />
              <span style={{ fontSize: 11, color: "#a1a1aa", fontWeight: 600 }}>All</span>
            </label>
          )}

          <button
            class="ctx-refresh-btn"
            style={{ marginLeft: 4 }}
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh projects"
            aria-label="Refresh projects"
          >
            <RefreshIcon spinning={refreshing} />
          </button>
        </div>

        {showCreate ? (
          <button class="proj-cancel-btn" onClick={() => setShowCreate(false)}>
            ✕ Cancel
          </button>
        ) : (
          <button class="proj-new-btn" onClick={() => setShowCreate(true)}>
            <PlusIcon size={12} /> New Project
          </button>
        )}
      </div>

      {/* ── Batch Selection Bar ── */}
      {selectedProjects.size > 0 && (
        <div class="batch-bar">
          <div class="batch-bar-left">
            <span class="batch-bar-count">{selectedProjects.size} selected</span>
          </div>
          <div class="batch-bar-right">
            <button class="batch-delete-btn" onClick={() => setShowBatchDeleteConfirm(true)}>
              <TrashIcon size={12} color="#ffffff" /> Delete ({selectedProjects.size})
            </button>
            <button class="batch-cancel-btn" onClick={() => setSelectedProjects(new Set())}>
              Deselect
            </button>
          </div>
        </div>
      )}

      {/* ── Create Project Form ─────────────────────────────── */}
      {showCreate && (
        <div class="proj-form-card">
          <div class="proj-form-group">
            <label class="proj-form-label">PROJECT TITLE *</label>
            <input
              class="proj-form-input"
              placeholder="Project title (e.g. EV Battery Tech)..."
              value={newTitle}
              onInput={(e) => setNewTitle(e.currentTarget.value)}
              autoFocus
            />
          </div>

          <div class="proj-form-group">
            <label class="proj-form-label">DESCRIPTION</label>
            <textarea
              class="proj-form-textarea"
              placeholder="Optional description or project goals..."
              rows={2}
              value={newDesc}
              onInput={(e) => setNewDesc(e.currentTarget.value)}
            />
          </div>

          <div class="proj-accent-row">
            <label class="proj-form-label" style={{ marginBottom: 0 }}>TAG ACCENT</label>
            <div class="proj-color-swatches">
              {ACCENT_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  class={`proj-color-dot ${newAccent === c.hex ? "active" : ""}`}
                  style={{ background: c.hex }}
                  onClick={() => setNewAccent(c.hex)}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          <button
            class="proj-create-btn"
            onClick={createProject}
            disabled={!newTitle.trim()}
          >
            <FolderIcon size={14} color="#000000" /> Create Project
          </button>
        </div>
      )}

      {/* ── Projects List ──────────────────────────────────── */}
      {projectList.length === 0 ? (
        <div class="tt-empty" style={{ paddingTop: 20 }}>
          <div class="tt-ready-badge" style={{ borderStyle: "dashed" }}>No projects yet</div>
          <p class="tt-empty-desc">
            Organize related research, notes, and web captures into dedicated topic workspaces.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {projectList.map((p) => {
            const count = projectCounts[p.project_id] ?? 0;
            const bannerColor = p.accent_color || "#DFFF00";
            const isEditing = editingProjectId === p.project_id;
            const isSelected = selectedProjects.has(p.project_id);

            return (
              <div key={p.project_id} class="proj-card">
                {/* Full-width top banner with selection checkbox */}
                <div class="proj-card-banner" style={{ background: bannerColor }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <input
                      type="checkbox"
                      class="item-checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleSelectProject(p.project_id);
                      }}
                      aria-label={`Select project ${p.title}`}
                    />
                    <span class="proj-card-banner-title">PROJECT</span>
                  </div>
                  <span class="proj-card-banner-items">{count} items</span>
                </div>

                {/* Card body */}
                <div class="proj-card-body">
                  {isEditing ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "4px 0" }}>
                      <input
                        class="proj-form-input"
                        value={editTitle}
                        onInput={(e) => setEditTitle(e.currentTarget.value)}
                        placeholder="Project title..."
                      />
                      <textarea
                        class="proj-form-textarea"
                        rows={2}
                        value={editDesc}
                        onInput={(e) => setEditDesc(e.currentTarget.value)}
                        placeholder="Project description..."
                      />
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button class="proj-cancel-btn" onClick={() => setEditingProjectId(null)}>
                          Cancel
                        </button>
                        <button class="proj-new-btn" onClick={() => saveEditing(p.project_id)}>
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div class="proj-card-title">{p.title}</div>
                      {p.description && <div class="proj-card-desc">{p.description}</div>}

                      {/* Action buttons row */}
                      <div class="proj-card-actions">
                        <div class="proj-actions-left">
                          <button
                            class="proj-view-btn"
                            onClick={() => openProject(p)}
                            title="View captures in this project"
                          >
                            <LayersIcon size={13} /> View Captures
                          </button>

                          <button
                            class="proj-icon-btn"
                            onClick={(e) => openAddModal(p, e)}
                            title="Add context or captures to this project"
                          >
                            <PlusIcon size={12} />
                          </button>

                          <button
                            class="proj-icon-btn"
                            onClick={(e) => startEditing(p, e)}
                            title="Edit project details"
                          >
                            <EditIcon size={12} />
                          </button>

                          <button
                            class="proj-icon-btn cc-action-danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSingleDeleteProjectTarget(p);
                            }}
                            title="Permanently delete project"
                          >
                            <TrashIcon size={12} color="var(--danger)" />
                          </button>
                        </div>

                        <span class="proj-date">
                          Created {new Date(p.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add Context / Captures Modal ────────────────────── */}
      {modalProject && (
        <div class="proj-modal-overlay" onClick={() => setModalProject(null)}>
          <div class="proj-modal" onClick={(e) => e.stopPropagation()}>
            <div class="proj-modal-header">
              <div>
                <div class="proj-modal-title">Add Context to "{modalProject.title}"</div>
                <div class="proj-modal-subtitle">Select a research context from active tab or library</div>
              </div>
              <button class="proj-modal-close" onClick={() => setModalProject(null)}>✕</button>
            </div>

            {activeTabContext && (
              <div>
                <div class="proj-modal-section-title">CURRENT TAB CONTEXT</div>
                <div class="proj-modal-item">
                  <div class="proj-modal-item-info">
                    <span class="proj-modal-item-name">⚡ {activeTabContext.title}</span>
                    <span class="proj-modal-item-meta">{activeTabContext.count} captures available on active tab</span>
                  </div>
                  <button
                    class="proj-modal-add-btn"
                    onClick={() => addContextToProject(activeTabContext.id, activeTabContext.title)}
                  >
                    <PlusIcon size={11} /> Add Context
                  </button>
                </div>
              </div>
            )}

            <div>
              <div class="proj-modal-section-title">SAVED LIBRARY CONTEXTS</div>
              {libraryContexts.length === 0 ? (
                <div style={{ fontSize: 11.5, color: "#71717a", padding: "8px 0" }}>
                  No saved contexts found in library.
                </div>
              ) : (
                libraryContexts.map((ctx) => (
                  <div key={ctx.id} class="proj-modal-item">
                    <div class="proj-modal-item-info">
                      <span class="proj-modal-item-name">{ctx.title}</span>
                      <span class="proj-modal-item-meta">{ctx.count} captures</span>
                    </div>
                    <button
                      class="proj-modal-add-btn"
                      onClick={() => addContextToProject(ctx.id, ctx.title)}
                    >
                      <PlusIcon size={11} /> Add Context
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmation Modals ── */}
      {singleDeleteProjectTarget && (
        <ConfirmModal
          isOpen={!!singleDeleteProjectTarget}
          title={`Permanently Delete "${singleDeleteProjectTarget.title}"?`}
          message="This project workspace and all its memberships will be permanently deleted. (Note: original captures remain in your library.)"
          confirmLabel={deleting ? "Deleting…" : "Permanently Delete"}
          onConfirm={handlePermanentDeleteSingle}
          onCancel={() => setSingleDeleteProjectTarget(null)}
        />
      )}

      <ConfirmModal
        isOpen={showBatchDeleteConfirm}
        title={`Permanently Delete ${selectedProjects.size} Project${selectedProjects.size === 1 ? "" : "s"}?`}
        message="All selected projects and their memberships will be permanently deleted from local storage. (Original captures remain in your library.)"
        itemCount={selectedProjects.size}
        confirmLabel={deleting ? "Deleting…" : "Permanently Delete All"}
        onConfirm={handlePermanentDeleteBatch}
        onCancel={() => setShowBatchDeleteConfirm(false)}
      />

      {/* Toast Feedback */}
      {toastMessage && <div class="proj-toast">{toastMessage}</div>}

      {/* ── Statusbar ──────────────────────────────────────── */}
      <div class="tt-statusbar">
        <span class="tt-status-left"><span class="tt-status-dot" /> Cloud Sync Connected</span>
        <span class="tt-status-right">v2.4 Pro</span>
      </div>
    </div>
  );
}
