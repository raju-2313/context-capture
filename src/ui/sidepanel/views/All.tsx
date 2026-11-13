import { useState, useEffect, useRef } from "preact/hooks";
import { captures as capRepo } from "../../../data/repositories";
import { searchIndex } from "../../../core/search/index";
import { CaptureCard } from "../../components/CaptureCard";
import { ConfirmModal } from "../../components/ConfirmModal";
import { SearchIcon, TrashIcon } from "../../components/Icons";

type SortOrder = "newest" | "oldest" | "domain";
const PAGE_SIZE = 50;

export default function AllCaptures({ onViewDetail }: { onViewDetail?: (id: string) => void } = {}) {
  const [captures, setCaptures] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({ type: "", domain: "" });
  const [sort, setSort] = useState<SortOrder>("newest");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [deletingBatch, setDeletingBatch] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    load();
    (window as any).__focusAllSearch = () => searchRef.current?.focus();
    return () => { delete (window as any).__focusAllSearch; };
  }, []);

  async function load() {
    const all = await capRepo.listAll({ limit: 100000 });
    setCaptures(all);
    setSelectedIds(new Set());
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
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(captureId);
      return next;
    });
  }

  function toggleSelect(captureId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(captureId)) next.delete(captureId);
      else next.add(captureId);
      return next;
    });
  }

  function toggleSelectAllOnPage() {
    const allPageIds = pageItems.map((c) => c.capture_id);
    const areAllSelected = allPageIds.every((id) => selectedIds.has(id));

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (areAllSelected) {
        for (const id of allPageIds) next.delete(id);
      } else {
        for (const id of allPageIds) next.add(id);
      }
      return next;
    });
  }

  function selectAllFiltered() {
    const allIds = allFiltered.map((c) => c.capture_id);
    setSelectedIds(new Set(allIds));
  }

  async function handleBatchPermanentDelete() {
    if (selectedIds.size === 0) return;
    setDeletingBatch(true);
    try {
      await capRepo.permanentDeleteMany(Array.from(selectedIds));
      setShowBatchDeleteConfirm(false);
      await load();
    } catch (err) {
      console.error("Failed to delete captures batch", err);
    } finally {
      setDeletingBatch(false);
    }
  }

  if (loading) return (
    <div class="sp-loading">
      <span class="sp-loading-dot" /><span class="sp-loading-dot" /><span class="sp-loading-dot" />
    </div>
  );

  const areAllOnPageSelected = pageItems.length > 0 && pageItems.every((c) => selectedIds.has(c.capture_id));

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

      {/* ── Sort + Meta Row with Select All ── */}
      <div class="lib-meta-row">
        <div class="lib-sort-group">
          {pageItems.length > 0 && (
            <label style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer", marginRight: 4 }}>
              <input
                type="checkbox"
                class="item-checkbox"
                checked={areAllOnPageSelected}
                onChange={toggleSelectAllOnPage}
                title="Select all on this page"
              />
              <span style={{ fontSize: 11, color: "#a1a1aa", fontWeight: 600 }}>Select</span>
            </label>
          )}

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

      {/* ── Batch Action Bar ── */}
      {selectedIds.size > 0 && (
        <div class="batch-bar">
          <div class="batch-bar-left">
            <span class="batch-bar-count">{selectedIds.size} selected</span>
            {selectedIds.size < allFiltered.length && (
              <button class="batch-bar-select-all" onClick={selectAllFiltered}>
                Select all {allFiltered.length}
              </button>
            )}
          </div>
          <div class="batch-bar-right">
            <button class="batch-delete-btn" onClick={() => setShowBatchDeleteConfirm(true)}>
              <TrashIcon size={12} color="#ffffff" /> Delete Selected ({selectedIds.size})
            </button>
            <button class="batch-cancel-btn" onClick={() => setSelectedIds(new Set())}>
              Deselect
            </button>
          </div>
        </div>
      )}

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
              selected={selectedIds.has(cap.capture_id)}
              onToggleSelect={toggleSelect}
              showCheckbox={true}
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

      {/* ── Confirmation Modal ── */}
      <ConfirmModal
        isOpen={showBatchDeleteConfirm}
        title={`Permanently Delete ${selectedIds.size} Capture${selectedIds.size === 1 ? "" : "s"}?`}
        message="All selected captures and their attachments will be permanently deleted from local storage. This action cannot be undone."
        itemCount={selectedIds.size}
        confirmLabel={deletingBatch ? "Deleting…" : "Permanently Delete"}
        onConfirm={handleBatchPermanentDelete}
        onCancel={() => setShowBatchDeleteConfirm(false)}
      />

      {/* ── Status Bar ── */}
      <div class="tt-statusbar">
        <span class="tt-status-left"><span class="tt-status-dot" /> Cloud Sync Connected</span>
        <span class="tt-status-right">v2.4</span>
      </div>
    </div>
  );
}
