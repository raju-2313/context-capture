import { useState, useEffect } from "preact/hooks";
import { contextLifecycle } from "../../../core/context/lifecycle";

type View = "active" | "archived";

export default function Contexts() {
  const [view, setView] = useState<View>("active");
  const [active, setActive] = useState<any[]>([]);
  const [archived, setArchived] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const [a, ar] = await Promise.all([contextLifecycle.listActive(), contextLifecycle.listArchived()]);
      setActive(a);
      setArchived(ar);
    } catch (e) {
      console.error("Failed to load contexts", e);
    } finally {
      setLoading(false);
    }
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

  if (loading) return <div class="empty-state">Loading...</div>;

  const list = view === "active" ? active : archived;

  return (
    <div class="container">
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button class={`btn ${view === "active" ? "btn-primary" : ""}`} onClick={() => setView("active")}>
          Active ({active.length})
        </button>
        <button class={`btn ${view === "archived" ? "btn-primary" : ""}`} onClick={() => setView("archived")}>
          Archived ({archived.length})
        </button>
      </div>

      {list.length === 0 ? (
        <div class="empty-state" style={{ height: "auto" }}>
          <p>No {view} contexts.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((ctx) => (
            <div key={ctx.context_id} class="card">
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
                  <span>{ctx.capture_count} captures</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button class="btn btn-icon" onClick={() => openContext(ctx)} title="Open in new tab">
                  Open Tab
                </button>
                <button class="btn btn-icon" onClick={() => bindToActiveTab(ctx)} title="Bind to current tab">
                  Bind to Current
                </button>
                {view === "archived" && (
                  <button class="btn btn-icon" onClick={() => restoreContext(ctx)} title="Restore to active">
                    Restore
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
