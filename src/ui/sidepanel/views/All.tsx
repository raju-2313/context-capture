import { useState, useEffect } from "preact/hooks";
import { captures as capRepo } from "../../../data/repositories";
import { contextLifecycle } from "../../../core/context/lifecycle";
import { CaptureCard } from "../../components/CaptureCard";

export default function AllCaptures() {
  const [captures, setCaptures] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({ type: "", domain: "" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const all = await capRepo.listAll({ limit: 10000 });
    setCaptures(all);
    setLoading(false);
  }

  function filtered() {
    let result = captures;
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter((c: any) =>
        (c.content_text || "").toLowerCase().includes(q) ||
        (c.user_note || "").toLowerCase().includes(q) ||
        (c.source_title || "").toLowerCase().includes(q) ||
        (c.source_url || "").toLowerCase().includes(q) ||
        (c.source_domain || "").toLowerCase().includes(q)
      );
    }
    if (filters.type) result = result.filter((c: any) => c.type === filters.type);
    if (filters.domain) result = result.filter((c: any) => c.source_domain === filters.domain);
    return result;
  }

  const domains = [...new Set(captures.map((c) => c.source_domain).filter(Boolean))];

  if (loading) return <div class="empty-state">Loading...</div>;

  return (
    <div class="container">
      <div class="filter-bar">
        <input
          class="search-bar"
          placeholder="Search captures..."
          value={query}
          onInput={(e) => setQuery(e.currentTarget.value)}
        />
        <select class="filter-select" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.currentTarget.value })}>
          <option value="">All types</option>
          <option value="text">Text</option>
          <option value="code">Code</option>
          <option value="link">Link</option>
          <option value="question">Question</option>
          <option value="note">Note</option>
          <option value="screenshot">Screenshot</option>
        </select>
        <select class="filter-select" value={filters.domain} onChange={(e) => setFilters({ ...filters, domain: e.currentTarget.value })}>
          <option value="">All domains</option>
          {domains.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <button class="btn" onClick={() => { setQuery(""); setFilters({ type: "", domain: "" }); }}>Clear</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered().length === 0 ? (
          <div class="empty-state" style={{ height: "auto" }}>
            <p>No captures match your filters.</p>
          </div>
        ) : (
          filtered().map((cap) => (
            <CaptureCard key={cap.capture_id} capture={cap} />
          ))
        )}
      </div>
    </div>
  );
}
