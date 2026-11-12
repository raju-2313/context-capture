import { SearchFilters, SearchResult } from "../../shared/types";
import { captures as capRepo } from "../../data/repositories";
import { normaliseSearchText, stripDiacritics } from "../../shared/types";
import { logger } from "../../shared/logger";

export class SearchIndex {
  private index: Map<string, Set<string>> = new Map();
  private captures: Map<string, any> = new Map();
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    await this.rebuild();
    this.initialized = true;
  }

  async rebuild(): Promise<void> {
    this.index = new Map();
    this.captures = new Map();
    const all = await capRepo.listAll({ limit: 100000 });
    for (const cap of all) {
      this.captures.set(cap.capture_id, cap);
      const terms = this.tokenize(cap.search_text || "");
      for (const term of terms) {
        if (!this.index.has(term)) this.index.set(term, new Set());
        this.index.get(term)!.add(cap.capture_id);
      }
    }
    logger.info(`Search index rebuilt with ${all.length} captures`);
  }

  async add(capture: any): Promise<void> {
    this.captures.set(capture.capture_id, capture);
    const terms = this.tokenize(capture.search_text || "");
    for (const term of terms) {
      if (!this.index.has(term)) this.index.set(term, new Set());
      this.index.get(term)!.add(capture.capture_id);
    }
  }

  async remove(captureId: string): Promise<void> {
    this.captures.delete(captureId);
    for (const [term, ids] of this.index) {
      ids.delete(captureId);
      if (ids.size === 0) this.index.delete(term);
    }
  }

  async update(capture: any): Promise<void> {
    await this.remove(capture.capture_id);
    await this.add(capture);
  }

  search(query: string, filters?: SearchFilters, limit: number = 50): SearchResult[] {
    const terms = this.tokenize(query);
    if (terms.length === 0) return [];

    let candidateIds: Set<string> | null = null;
    for (const term of terms) {
      const ids = this.index.get(term);
      if (!ids) return [];
      const idArray = Array.from(ids);
      candidateIds = candidateIds
        ? new Set(idArray.filter((id) => candidateIds!.has(id)))
        : new Set(idArray);
    }

    if (!candidateIds) return [];

    const results: SearchResult[] = [];
    for (const id of candidateIds) {
      const cap = this.captures.get(id);
      if (!cap) continue;
      if (this.matchesFilters(cap, filters)) {
        results.push({
          capture_id: id,
          score: this.score(cap, terms),
          snippet: this.makeSnippet(cap, terms),
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  private tokenize(text: string): string[] {
    return stripDiacritics(text.toLowerCase())
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 0);
  }

  private matchesFilters(cap: any, filters?: SearchFilters): boolean {
    if (!filters) return true;
    if (filters.type && !filters.type.includes(cap.type)) return false;
    if (filters.domain && filters.domain.length > 0 && cap.source_domain && !filters.domain.includes(cap.source_domain)) return false;
    if (filters.context && filters.context.length > 0 && !filters.context.includes(cap.context_id)) return false;
    if (filters.date_from && new Date(cap.created_at) < new Date(filters.date_from)) return false;
    if (filters.date_to && new Date(cap.created_at) > new Date(filters.date_to)) return false;
    return true;
  }

  private score(cap: any, terms: string[]): number {
    let score = 0;
    const text = (cap.search_text || "").toLowerCase();
    for (const term of terms) {
      if (text.includes(term)) score += 1;
    }
    return score;
  }

  private makeSnippet(cap: any, terms: string[]): string | null {
    const text = cap.search_text || cap.content_text || cap.source_title || "";
    if (!text) return null;
    const lower = text.toLowerCase();
    let pos = -1;
    for (const term of terms) {
      const idx = lower.indexOf(term.toLowerCase());
      if (idx >= 0) { pos = idx; break; }
    }
    if (pos < 0) return text.slice(0, 150);
    const start = Math.max(0, pos - 50);
    const end = Math.min(text.length, pos + 100);
    return text.slice(start, end);
  }
}

export const searchIndex = new SearchIndex();