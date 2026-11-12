import { useState, useEffect, useRef } from "preact/hooks";
import { captures as capRepo } from "../../../data/repositories";
import { contextLifecycle } from "../../../core/context/lifecycle";
import { CaptureCard } from "../../components/CaptureCard";
import { searchIndex } from "../../../core/search/index";

type SortOrder = "newest" | "oldest" | "domain";

const PAGE_SIZE = 50;

export default function AllCaptures({ onViewDetail }: { onViewDetail?: (id: string) => void } = {}) {
  const [captures, setCaptures] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({ type: "", domain: "" });
  const [sort, setSort] = useState<SortOrder>("newest");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    load();
    // expose focusSearch globally for keyboard shortcuts
    (window as any).__focusAllSearch = () => searchRef.current?.focus();
    return () => { delete (window as any).__focusAllSearch; };
  }, []);

  async function load() {
    const all = await capRepo.listAll({ limit: 100000 });
    setCaptures(all);
    // prime search index
    await searchIndex.rebuild();
    setLoading(false);
  }

  function filtered() {
    let result = captures.filter((c: any) => !c.deleted_at);

    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter((c: any) =>
        (c.content_text || "").toLowerCase().includes(q) ||
        (c.user_note || "").toLowerCase().includes(q) ||
        (c.source_title || "").toLowerCase().includes(q) ||
        (c.source_url || "").toLowerCase().includes(q) ||
        (c.source_domain || "").toLowerCase().includes(q) ||
        (c.tags || []).some((t: string) => t.toLowerCase().includes(q))
      );
    }
    if (filters.type) result = result.filter((c: any) => c.type === filters.type);
    if (filters.domain) result = result.filter((c: any) => c.source_domain === filters.domain);

    // Sort
    result = [...result].sort((a, b) => {
      if (sort === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sort === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sort === "domain") return (a.source_domain || "").localeCompare(b.source_domain || "");
      return 0;
    });

    return result;
  }

  const allFiltered = filtered();
  const pageItems = allFiltered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(allFiltered.length / PAGE_SIZE);

  const domains = [...new Set(captures.map((c) => c.source_domain).filter(Boolean))] as string[];

  function clearFilters() {
    setQuery("");
    setFilters({ type: "", domain: "" });
    setSort("newest");
    setPage(0);
  }

  function handleDelete(captureId: string) {
    setCaptures((prev) => prev.filter((c) => c.capture_id !== captureId));
  }

  if (loading) return <div class="empty-state">Loading...</div>;

  return (
    <div class="container">
      <div class="filter-bar" style={{ flexWrap: "wrap", gap: 6 }}>
        <input
          ref={searchRef}
          class="search-bar"
          placeholder="Search captures..."
          value={query}
          onInput={(e) => { setQuery(e.currentTarget.value); setPage(0); }}
          aria-label="Search captures"
        />
        <select
          class="filter-select"
          value={filters.type}
          onChange={(e) => { setFilters({ ...filters, type: e.currentTarget.value }); setPage(0); }}
          aria-label="Filter by type"
        >
          <option value="">All types</option>
          <option value="text">Text</option>
          <option value="code">Code</option>
          <option value="link">Link</option>
          <option value="question">Question</option>
          <option value="note">Note</option>
          <option value="screenshot">Screenshot</option>
        </select>
        <select
          class="filter-select"
          value={filters.domain}
          onChange={(e) => { setFilters({ ...filters, domain: e.currentTarget.value }); setPage(0); }}
          aria-label="Filter by domain"
        >
          <option value="">All domains</option>
          {domains.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select
          class="filter-select"
          value={sort}
          onChange={(e) => { setSort(e.currentTarget.value as SortOrder); setPage(0); }}
          aria-label="Sort order"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="domain">Domain A–Z</option>
        </select>
        <button class="btn" onClick={clearFilters}>Clear</button>
      </div>

      <div style={{ padding: "4px 0 8px", fontSize: 11, color: "var(--text-secondary)" }}>
        {allFiltered.length === 0
          ? "No captures match your filters."
          : `Showing ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, allFiltered.length)} of ${allFiltered.length}`}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {pageItems.length === 0 ? (
          <div class="empty-state" style={{ height: "auto" }}>
            <p>No captures match your filters.</p>
          </div>
        ) : (
          pageItems.map((cap) => (
            <CaptureCard
              key={cap.capture_id}
              capture={cap}
              onDelete={() => handleDelete(cap.capture_id)}
              onViewDetail={onViewDetail}
            />
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 16, padding: "8px 0" }}>
          <button
            class="btn"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            &larr; Prev
          </button>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Page {page + 1} of {totalPages}
          </span>
          <button
            class="btn"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            Next &rarr;
          </button>
        </div>
      )}
    </div>
  );
}
