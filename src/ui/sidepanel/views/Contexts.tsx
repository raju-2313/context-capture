import { useState, useEffect } from "preact/hooks";
import { contextLifecycle } from "../../../core/context/lifecycle";
import { captures as capRepo, contexts as ctxRepo } from "../../../data/repositories";
import { exportEngine } from "../../../core/export";
import { MarkdownIcon, TrashIcon } from "../../components/Icons";
import { ConfirmModal } from "../../components/ConfirmModal";

type View = "active" | "archived";

export default function Contexts() {
  const [view, setView] = useState<View>("active");
  const [active, setActive] = useState<any[]>([]);
  const [archived, setArchived] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mergeTarget, setMergeTarget] = useState<string>("");
  const [merging, setMerging] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [captureCounts, setCaptureCounts] = useState<Record<string, number>>({});

  // Permanent Delete states
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [singleDeleteTarget, setSingleDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [a, ar] = await Promise.all([contextLifecycle.listActive(), contextLifecycle.listArchived()]);
      setActive(a); setArchived(ar);
      setSelected(new Set()); setMergeTarget("");
      const counts: Record<string, number> = {};
      for (const ctx of [...a, ...ar]) {
        const caps = await capRepo.listByContext(ctx.context_id);
        counts[ctx.context_id] = caps.length;
      }
      setCaptureCounts(counts);
    } catch (e) { console.error("Failed to load contexts", e); }
    finally { setLoading(false); }
  }

  function toggleSelect(ctxId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ctxId)) next.delete(ctxId); else next.add(ctxId);
      return next;
    });
  }

  function toggleSelectAll() {
    const list = view === "active" ? active : archived;
    const allIds = list.map((c) => c.context_id);
    const areAllSelected = allIds.every((id) => selected.has(id));

    setSelected((prev) => {
      const next = new Set(prev);
      if (areAllSelected) {
        for (const id of allIds) next.delete(id);
      } else {
        for (const id of allIds) next.add(id);
      }
      return next;
    });
  }

  async function openContext(ctx: any) {
    const url = ctx.last_url || ctx.first_url || "about:blank";
    const tab = await chrome.tabs.create({ url });
    if (tab.id && tab.windowId) { await contextLifecycle.rebindToTab(ctx.context_id, tab.id, tab.windowId); await load(); }
  }

  async function bindToActiveTab(ctx: any) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id && tab?.windowId) {
      await contextLifecycle.rebindToTab(ctx.context_id, tab.id, tab.windowId);
      chrome.runtime.sendMessage({ type: "CONTEXT_CHANGED", payload: { contextId: ctx.context_id } });
      await load();
    }
  }

  async function restoreContext(ctx: any) {
    await contextLifecycle.restoreContext(ctx.context_id); await load();
  }

  async function handleMerge() {
    if (!mergeTarget || selected.size === 0) return;
    setMerging(true);
    try {
      const sources = Array.from(selected).filter((id) => id !== mergeTarget);
      for (const srcId of sources) await contextLifecycle.mergeContexts(srcId, mergeTarget);
      await load();
    } catch (e) { console.error("Merge failed", e); }
    finally { setMerging(false); }
  }

  async function handlePermanentDeleteSingle() {
    if (!singleDeleteTarget) return;
    setDeleting(true);
    try {
      await ctxRepo.permanentDelete(singleDeleteTarget.id);
      setSingleDeleteTarget(null);
      try { chrome.runtime?.sendMessage?.({ type: "CAPTURE_DELETED" }); } catch {}
      await load();
    } catch (err) {
      console.error("Failed to delete context", err);
    } finally {
      setDeleting(false);
    }
  }

  async function handlePermanentDeleteBatch() {
    if (selected.size === 0) return;
    setDeleting(true);
    try {
      await ctxRepo.permanentDeleteMany(Array.from(selected));
      setShowBatchDeleteConfirm(false);
      setSelected(new Set());
      try { chrome.runtime?.sendMessage?.({ type: "CAPTURE_DELETED" }); } catch {}
      await load();
    } catch (err) {
      console.error("Failed to batch delete contexts", err);
    } finally {
      setDeleting(false);
    }
  }

  async function exportContextMd(ctxId: string, ctxTitle: string) {
    setExportingId(ctxId);
    try {
      const blob = await exportEngine.exportMarkdownContext(ctxId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `context-${ctxTitle.replace(/\s+/g, "-").slice(0, 40)}-${new Date().toISOString().slice(0, 10)}.md`;
      a.click(); URL.revokeObjectURL(url);
    } finally { setExportingId(null); }
  }

  if (loading) return (
    <div class="sp-loading">
      <span class="sp-loading-dot" /><span class="sp-loading-dot" /><span class="sp-loading-dot" />
    </div>
  );

  const list = view === "active" ? active : archived;
  const allList = [...active, ...archived];
  const areAllSelected = list.length > 0 && list.every((c) => selected.has(c.context_id));

  return (
    <div class="tt-root">
      {/* ── View Toggle & Select All Row ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
        <div class="ctx-toggle-row" style={{ margin: 0, flex: 1 }}>
          <button class={`ctx-toggle-btn ${view === "active" ? "active" : ""}`} onClick={() => { setView("active"); setSelected(new Set()); }}>
            Active
            <span class="ctx-toggle-count">{active.length}</span>
          </button>
          <button class={`ctx-toggle-btn ${view === "archived" ? "active" : ""}`} onClick={() => { setView("archived"); setSelected(new Set()); }}>
            Archived
            <span class="ctx-toggle-count">{archived.length}</span>
          </button>
        </div>

        {list.length > 0 && (
          <label style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer", paddingRight: 4 }}>
            <input
              type="checkbox"
              class="item-checkbox"
              checked={areAllSelected}
              onChange={toggleSelectAll}
              title="Select all contexts in view"
            />
            <span style={{ fontSize: 11, color: "#a1a1aa", fontWeight: 600 }}>All</span>
          </label>
        )}
      </div>

      {/* ── Batch Selection Action Bar ── */}
      {selected.size > 0 && (
        <div class="batch-bar">
          <div class="batch-bar-left">
            <span class="batch-bar-count">{selected.size} selected</span>
          </div>
          <div class="batch-bar-right">
            <button class="batch-delete-btn" onClick={() => setShowBatchDeleteConfirm(true)}>
              <TrashIcon size={12} color="#ffffff" /> Delete ({selected.size})
            </button>
            <button class="batch-cancel-btn" onClick={() => setSelected(new Set())}>
              Deselect
            </button>
          </div>
        </div>
      )}

      {/* ── Merge Toolbar (when 2+ selected) ── */}
      {selected.size >= 2 && (
        <div class="ctx-merge-bar">
          <span class="ctx-merge-label">Merge {selected.size} into:</span>
          <select class="lib-select" value={mergeTarget} onChange={(e) => setMergeTarget(e.currentTarget.value)} style={{ flex: 1 }}>
            <option value="">Select target…</option>
            {allList.filter((ctx) => selected.has(ctx.context_id)).map((ctx) => (
              <option key={ctx.context_id} value={ctx.context_id}>{ctx.title}</option>
            ))}
          </select>
          <button class="tt-submit-btn" onClick={handleMerge} disabled={!mergeTarget || merging}>
            {merging ? "Merging…" : "Merge"}
          </button>
        </div>
      )}

      {/* ── Context List ── */}
      {list.length === 0 ? (
        <div class="tt-empty" style={{ paddingTop: 20 }}>
          <div class="tt-ready-badge" style={{ borderStyle: "dashed" }}>No {view} contexts</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {list.map((ctx) => {
            const isSelected = selected.has(ctx.context_id);
            return (
              <div key={ctx.context_id} class={`ctx-card ${isSelected ? "selected" : ""}`}>
                {/* Banner = status */}
                <div class="cc-card-banner">{(ctx.status || view).toUpperCase()}</div>

                <div class="cc-card-body">
                  <div class="ctx-card-top">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(ctx.context_id)}
                      class="item-checkbox"
                      aria-label={`Select ${ctx.title}`}
                    />
                    <div class="cc-card-title" style={{ flex: 1 }}>{ctx.title}</div>
                  </div>

                  <div class="cc-card-domain">
                    {ctx.last_url && (() => { try { return new URL(ctx.last_url).hostname; } catch { return ctx.last_url; } })()}
                    {" · "}
                    {captureCounts[ctx.context_id] ?? 0} captures
                  </div>

                  <div class="cc-card-actions">
                    <div class="cc-actions-left">
                      <button class="cc-action-btn" onClick={() => openContext(ctx)} title="Open in new tab">Open Tab</button>
                      <button class="cc-action-btn" onClick={() => bindToActiveTab(ctx)} title="Bind to current tab">Bind</button>
                      {view === "archived" && (
                        <button class="cc-action-btn" onClick={() => restoreContext(ctx)}>Restore</button>
                      )}
                      <button
                        class="cc-action-btn"
                        onClick={() => exportContextMd(ctx.context_id, ctx.title)}
                        disabled={exportingId === ctx.context_id}
                        title="Export as Markdown"
                      >
                        <MarkdownIcon size={12} />
                        {exportingId === ctx.context_id ? "Exporting…" : "MD"}
                      </button>
                      <button
                        class="cc-action-btn cc-action-danger"
                        onClick={() => setSingleDeleteTarget({ id: ctx.context_id, title: ctx.title })}
                        title="Permanently delete context"
                      >
                        <TrashIcon size={12} color="var(--danger)" />
                      </button>
                    </div>
                    <span class="cc-action-date">
                      {new Date(ctx.last_active_at || ctx.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Confirmation Modals ── */}
      {singleDeleteTarget && (
        <ConfirmModal
          isOpen={!!singleDeleteTarget}
          title={`Permanently Delete "${singleDeleteTarget.title}"?`}
          message="This context and all captures collected within it will be permanently removed from local storage. This action cannot be undone."
          confirmLabel={deleting ? "Deleting…" : "Permanently Delete"}
          onConfirm={handlePermanentDeleteSingle}
          onCancel={() => setSingleDeleteTarget(null)}
        />
      )}

      <ConfirmModal
        isOpen={showBatchDeleteConfirm}
        title={`Permanently Delete ${selected.size} Context${selected.size === 1 ? "" : "s"}?`}
        message="All selected contexts and all of their captures will be permanently removed from local storage. This action cannot be undone."
        itemCount={selected.size}
        confirmLabel={deleting ? "Deleting…" : "Permanently Delete All"}
        onConfirm={handlePermanentDeleteBatch}
        onCancel={() => setShowBatchDeleteConfirm(false)}
      />

      {/* ── Status Bar ── */}
      <div class="tt-statusbar">
        <span class="tt-status-left"><span class="tt-status-dot" /> Sync Active</span>
        <span class="tt-status-right">v2.4</span>
      </div>
    </div>
  );
}
