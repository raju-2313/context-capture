import { useState, useEffect } from "preact/hooks";
import { aiAssistant, GroundedAnswer, Citation } from "../../../core/ai/assistant";
import { contexts as ctxRepo, projects as projRepo } from "../../../data/repositories";

interface AssistantViewProps {
  onViewDetail?: (captureId: string) => void;
}

export default function AssistantView({ onViewDetail }: AssistantViewProps) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"all" | "context" | "project">("all");
  const [scopeId, setScopeId] = useState<string>("");
  const [contexts, setContexts] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<GroundedAnswer | null>(null);
  const [summary, setSummary] = useState<{ title: string; summary: string; citations: Citation[] } | null>(null);

  useEffect(() => {
    loadScopes();
  }, []);

  async function loadScopes() {
    const [ctxList, prjList] = await Promise.all([
      ctxRepo.list({ status: "active" }),
      projRepo.list(),
    ]);
    setContexts(ctxList);
    setProjects(prjList);
    if (ctxList.length > 0) setScopeId(ctxList[0].context_id);
    else if (prjList.length > 0) setScopeId(prjList[0].project_id);
  }

  async function handleAsk(q?: string) {
    const text = q || query;
    if (!text.trim()) return;
    setLoading(true);
    setSummary(null);
    try {
      const result = await aiAssistant.ask(text, {
        scope,
        scopeId: scope !== "all" ? scopeId : undefined,
      });
      setAnswer(result);
    } catch (e) {
      console.error("AI Ask error", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSummarize() {
    if (scope === "all") {
      alert("Please select a specific Context or Project to summarize.");
      return;
    }
    setLoading(true);
    setAnswer(null);
    try {
      const result = await aiAssistant.generateSummary(scope as "context" | "project", scopeId);
      setSummary(result);
    } catch (e) {
      console.error("Summarize error", e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div class="container" style={{ padding: "12px 14px", overflowY: "auto" }}>
      {/* Privacy guarantee banner */}
      <div
        style={{
          background: "var(--muted)",
          padding: "8px 12px",
          borderRadius: 8,
          marginBottom: 12,
          fontSize: 11,
          display: "flex",
          alignItems: "center",
          gap: 6,
          color: "var(--text-secondary)",
        }}
      >
        <span>🔒</span>
        <span>
          <strong>Grounded AI</strong> — Answers cite only your saved captures. Zero external telemetry.
        </span>
      </div>

      {/* Scope selector */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <select
          class="filter-select"
          value={scope}
          onChange={(e) => {
            const newScope = e.currentTarget.value as any;
            setScope(newScope);
            if (newScope === "context" && contexts.length > 0) setScopeId(contexts[0].context_id);
            if (newScope === "project" && projects.length > 0) setScopeId(projects[0].project_id);
          }}
          style={{ width: "auto" }}
        >
          <option value="all">All Captures</option>
          <option value="context">Specific Context</option>
          <option value="project">Specific Project</option>
        </select>

        {scope === "context" && (
          <select
            class="filter-select"
            value={scopeId}
            onChange={(e) => setScopeId(e.currentTarget.value)}
            style={{ flex: 1 }}
          >
            {contexts.map((c) => (
              <option key={c.context_id} value={c.context_id}>{c.title}</option>
            ))}
          </select>
        )}

        {scope === "project" && (
          <select
            class="filter-select"
            value={scopeId}
            onChange={(e) => setScopeId(e.currentTarget.value)}
            style={{ flex: 1 }}
          >
            {projects.map((p) => (
              <option key={p.project_id} value={p.project_id}>{p.title}</option>
            ))}
          </select>
        )}
      </div>

      {/* Query Bar */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <input
          class="search-bar"
          placeholder="Ask a question about your captures..."
          value={query}
          onInput={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAsk();
          }}
        />
        <button class="btn btn-primary" onClick={() => handleAsk()} disabled={loading}>
          {loading ? "..." : "Ask"}
        </button>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        <button
          class="btn"
          style={{ fontSize: 11, padding: "3px 8px" }}
          onClick={() => {
            setQuery("What are the key points?");
            handleAsk("What are the key points?");
          }}
        >
          💡 Key points?
        </button>
        <button
          class="btn"
          style={{ fontSize: 11, padding: "3px 8px" }}
          onClick={() => {
            setQuery("What questions did I capture?");
            handleAsk("What questions did I capture?");
          }}
        >
          ❓ My questions
        </button>
        {scope !== "all" && (
          <button
            class="btn"
            style={{ fontSize: 11, padding: "3px 8px", background: "var(--surface)" }}
            onClick={handleSummarize}
            disabled={loading}
          >
            📝 Summarize Scope
          </button>
        )}
      </div>

      {/* Results view */}
      {loading && <div class="empty-state">Thinking &amp; citing captures...</div>}

      {answer && (
        <div style={{ marginTop: 8 }}>
          <div
            style={{
              padding: 14,
              background: "var(--card)",
              borderRadius: 8,
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow)",
              lineHeight: 1.6,
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: "var(--accent)" }}>
              Q: {answer.query}
            </div>
            <div style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{answer.answer}</div>
          </div>

          {/* Citations */}
          {answer.citations.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, textTransform: "uppercase" }}>
                Cited Captures ({answer.citations.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {answer.citations.map((cite, idx) => (
                  <div
                    key={cite.capture_id}
                    class="card"
                    style={{ margin: 0, padding: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
                    onClick={() => onViewDetail && onViewDetail(cite.capture_id)}
                    title="Click to view capture"
                  >
                    <span style={{ fontWeight: 700, color: "var(--accent)", fontSize: 11 }}>[{idx + 1}]</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {cite.title}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {cite.snippet}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {summary && (
        <div style={{ marginTop: 8 }}>
          <div
            style={{
              padding: 14,
              background: "var(--card)",
              borderRadius: 8,
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow)",
              lineHeight: 1.6,
            }}
          >
            <div style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{summary.summary}</div>
          </div>

          {summary.citations.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, textTransform: "uppercase" }}>
                Supporting Captures
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {summary.citations.map((cite, idx) => (
                  <div
                    key={cite.capture_id}
                    class="card"
                    style={{ margin: 0, padding: 8, cursor: "pointer" }}
                    onClick={() => onViewDetail && onViewDetail(cite.capture_id)}
                  >
                    <span style={{ fontWeight: 700, color: "var(--accent)", fontSize: 11 }}>[{idx + 1}] </span>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{cite.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!answer && !summary && !loading && (
        <div class="empty-state" style={{ height: "auto", padding: "32px 16px" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🤖</div>
          <h3>AI Knowledge Assistant</h3>
          <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Ask anything about your saved knowledge. Answers are synthesised with verifiable citations back to your captures.
          </p>
        </div>
      )}
    </div>
  );
}

