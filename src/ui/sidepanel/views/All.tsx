import { useState, useEffect, useRef } from "preact/hooks";
import { captures as capRepo } from "../../../data/repositories";
import { searchIndex } from "../../../core/search/index";
import { CaptureCard } from "../../components/CaptureCard";
import { SearchIcon } from "../../components/Icons";

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
    (window as any).__focusAllSearch = () => searchRef.current?.focus();
    return () => { delete (window as any).__focusAllSearch; };
  }, []);

  async function load() {
    const all = await capRepo.listAll({ limit: 100000 });
    setCaptures(all);
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
  const hasFilters = !!(query || filters.type || filters.domain || sort !== "newest");

  function clearFilters() {
    setQuery(""); setFilters({ type: "", domain: "" }); setSort("newest"); setPage(0);
  }

  function handleDelete(captureId: string) {
    setCaptures((prev) => prev.filter((c) => c.capture_id !== captureId));
  }

  if (loading) return (
    <div class="sp-loading">
      <span class="sp-loading-dot" /><span class="sp-loading-dot" /><span class="sp-loading-dot" />
    </div>
  );

  return (
    <div class="tt-root">
      {/* ── Search Bar ── */}
      <div class="lib-search-wrap">
        <div class="lib-search-input-wrap">
          <SearchIcon size={13} style={{ color: "#52525b", flexShrink: 0 }} />
          <input
            ref={searchRef}
            class="lib-search-input"
            placeholder="Search captures..."
            value={query}
            onInput={(e) => { setQuery(e.currentTarget.value); setPage(0); }}
            aria-label="Search captures"
          />
        </div>
        <select
          class="lib-select"
          value={filters.type}
          onChange={(e) => { setFilters({ ...filters, type: e.currentTarget.value }); setPage(0); }}
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
          class="lib-select"
          value={filters.domain}
          onChange={(e) => { setFilters({ ...filters, domain: e.currentTarget.value }); setPage(0); }}
        >
          <option value="">All domains</option>
          {domains.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* ── Sort + meta row ── */}
      <div class="lib-meta-row">
        <div class="lib-sort-group">
          <select class="lib-sort-select" value={sort} onChange={(e) => { setSort(e.currentTarget.value as SortOrder); setPage(0); }}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="domain">Domain A–Z</option>
          </select>
          {hasFilters && (
            <button class="lib-clear-btn" onClick={clearFilters}>Clear</button>
          )}
        </div>
        <span class="lib-count">
          {allFiltered.length === 0
            ? "No results"
            : `Showing ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, allFiltered.length)} of ${allFiltered.length}`}
        </span>
      </div>

      {/* ── Capture List ── */}
      {pageItems.length === 0 ? (
        <div class="tt-empty" style={{ paddingTop: 24 }}>
          <div class="tt-ready-badge" style={{ borderStyle: "dashed" }}>No captures found</div>
          <p class="tt-empty-desc">Try a different search term or clear your filters.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {pageItems.map((cap) => (
            <CaptureCard
              key={cap.capture_id}
              capture={cap}
              onDelete={() => handleDelete(cap.capture_id)}
              onViewDetail={onViewDetail}
            />
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div class="lib-pagination">
          <button class="lib-page-btn" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
            ← Prev
          </button>
          <span class="lib-page-info">Page {page + 1} of {totalPages}</span>
          <button class="lib-page-btn" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
            Next →
          </button>
        </div>
      )}

      {/* ── Status Bar ── */}
      <div class="tt-statusbar">
        <span class="tt-status-left"><span class="tt-status-dot" /> Cloud Sync Connected</span>
        <span class="tt-status-right">v2.4</span>
      </div>
    </div>
  );
}
