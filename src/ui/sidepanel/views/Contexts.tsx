import { useState, useEffect } from "preact/hooks";
import { contextLifecycle } from "../../../core/context/lifecycle";
import { captures as capRepo } from "../../../data/repositories";
import { exportEngine } from "../../../core/export";
import { MarkdownIcon, FolderIcon } from "../../components/Icons";

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

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const [a, ar] = await Promise.all([
        contextLifecycle.listActive(),
        contextLifecycle.listArchived(),
      ]);
      setActive(a);
      setArchived(ar);
      setSelected(new Set());
      setMergeTarget("");

      // Load capture counts for each context
      const counts: Record<string, number> = {};
      for (const ctx of [...a, ...ar]) {
        const caps = await capRepo.listByContext(ctx.context_id);
        counts[ctx.context_id] = caps.length;
      }
      setCaptureCounts(counts);
    } catch (e) {
      console.error("Failed to load contexts", e);
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(ctxId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ctxId)) next.delete(ctxId);
      else next.add(ctxId);
      return next;
    });
  }

  async function openContext(ctx: any) {
    const url = ctx.last_url || ctx.first_url || "about:blank";
    const tab = await chrome.tabs.create({ url });
    if (tab.id && tab.windowId) {
      await contextLifecycle.rebindToTab(ctx.context_id, tab.id, tab.windowId);
      await load();
    }
  }

  async function bindToActiveTab(ctx: any) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id && tab.windowId) {
      await contextLifecycle.rebindToTab(ctx.context_id, tab.id, tab.windowId);
      chrome.runtime.sendMessage({ type: "CONTEXT_CHANGED", payload: { contextId: ctx.context_id } });
      await load();
    }
  }

  async function restoreContext(ctx: any) {
    await contextLifecycle.restoreContext(ctx.context_id);
    await load();
  }

  async function handleMerge() {
    if (!mergeTarget || selected.size === 0) return;
    setMerging(true);
    try {
      const sources = Array.from(selected).filter((id) => id !== mergeTarget);
      // merge sequentially: each source into target
      for (const srcId of sources) {
        await contextLifecycle.mergeContexts(srcId, mergeTarget);
      }
      await load();
    } catch (e) {
      console.error("Merge failed", e);
    } finally {
      setMerging(false);
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
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportingId(null);
    }
  }

  if (loading) return <div class="empty-state">Loading...</div>;

  const list = view === "active" ? active : archived;
  const allList = [...active, ...archived];

  return (
    <div class="view-container">
      {/* View toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button class={`btn ${view === "active" ? "btn-primary" : ""}`} onClick={() => { setView("active"); setSelected(new Set()); }}>
          Active ({active.length})
        </button>
        <button class={`btn ${view === "archived" ? "btn-primary" : ""}`} onClick={() => { setView("archived"); setSelected(new Set()); }}>
          Archived ({archived.length})
        </button>
      </div>

      {/* Merge toolbar — appears when 2+ selected */}
      {selected.size >= 2 && (
        <div
          style={{
            marginBottom: 12,
            padding: "10px 12px",
            background: "var(--surface)",
            border: "1px solid var(--accent)",
            borderRadius: 8,
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600 }}>{selected.size} selected — merge into:</span>
          <select
            class="filter-select"
            value={mergeTarget}
            onChange={(e) => setMergeTarget(e.currentTarget.value)}
            style={{ flex: 1 }}
          >
            <option value="">Select target context…</option>
            {allList
              .filter((ctx) => selected.has(ctx.context_id))
              .map((ctx) => (
                <option key={ctx.context_id} value={ctx.context_id}>{ctx.title}</option>
              ))}
          </select>
          <button
            class="btn btn-primary"
            onClick={handleMerge}
            disabled={!mergeTarget || merging}
          >
            {merging ? "Merging…" : "Merge"}
          </button>
          <button class="btn" onClick={() => setSelected(new Set())}>Cancel</button>
        </div>
      )}

      {list.length === 0 ? (
        <div class="empty-state" style={{ height: "auto" }}>
          <p>No {view} contexts.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((ctx) => (
            <div
              key={ctx.context_id}
              class="card"
              style={{
                borderLeft: selected.has(ctx.context_id) ? "3px solid var(--accent)" : "3px solid transparent",
              }}
            >
              <input
                type="checkbox"
                checked={selected.has(ctx.context_id)}
                onChange={() => toggleSelect(ctx.context_id)}
                style={{ marginTop: 2, flexShrink: 0 }}
                aria-label={`Select ${ctx.title}`}
              />
              <div class="card-content">
                <div class="card-title">{ctx.title}</div>
                <div class="card-meta">
                  <span class={`badge badge-${ctx.status}`}>{ctx.status}</span>
                  {ctx.last_url && (
                    <span>
                      {(() => {
                        try { return new URL(ctx.last_url).hostname; } catch { return ctx.last_url; }
                      })()}
                    </span>
                  )}
                  <span>{captureCounts[ctx.context_id] ?? 0} captures</span>
                  <span style={{ color: "var(--text-secondary)", fontSize: 10 }}>
                    {new Date(ctx.last_active_at || ctx.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  <button class="btn btn-icon" onClick={() => openContext(ctx)} title="Open in new tab" aria-label="Open context in new tab">
                    Open Tab
                  </button>
                  <button class="btn btn-icon" onClick={() => bindToActiveTab(ctx)} title="Bind to current tab" aria-label="Bind to current tab">
                    Bind
                  </button>
                  {view === "archived" && (
                    <button class="btn btn-icon" onClick={() => restoreContext(ctx)} title="Restore to active" aria-label="Restore context">
                      Restore
                    </button>
                  )}
                  <button
                    class="btn btn-icon"
                    onClick={() => exportContextMd(ctx.context_id, ctx.title)}
                    disabled={exportingId === ctx.context_id}
                    title="Export as Markdown"
                    aria-label="Export context as Markdown"
                    style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    <MarkdownIcon size={12} />
                    {exportingId === ctx.context_id ? "Exporting…" : "Markdown"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected.size === 1 && (
        <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-secondary)", textAlign: "center" }}>
          Select at least 2 contexts to enable merge.
        </div>
      )}
    </div>
  );
}
