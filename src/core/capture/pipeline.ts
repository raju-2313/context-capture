import { contextLifecycle } from "../context/lifecycle";
import { captures as capRepo, attachments as attRepo, tags as tagRepo, contexts as ctxRepo } from "../../data/repositories";
import { settingsStore } from "../../data/settings";
import {
  Capture,
  generateId,
  nowISO,
  normaliseSearchText,
  extractDomain,
} from "../../shared/types";
import { logger } from "../../shared/logger";
import { createRestrictedPageError, createCaptureError } from "../../shared/errors";
import { isRestrictedUrl } from "../../shared/constants";

class CapturePipeline {
  async captureText(input: {
    text: string;
    tabId: number;
    windowId: number;
    note?: string;
    tags?: string[];
    anchor?: { prefix: string; suffix: string };
    highlightColor?: string;
  }): Promise<string> {
    const { text, tabId, windowId, note, tags, anchor, highlightColor } = input;
    if (!text || text.trim().length === 0) {
      throw new Error("Empty selection");
    }

    const truncated = text.length > 100000 ? text.slice(0, 100000) : text;
    const contextId = await contextLifecycle.getOrCreateForTab(tabId, windowId);

    const tab = await this.getTabInfo(tabId);
    const sourceUrl = tab?.url ?? null;
    const sourceTitle = tab?.title ?? null;
    const domain = sourceUrl ? extractDomain(sourceUrl) : null;

    const restricted = sourceUrl ? isRestrictedUrl(sourceUrl) : false;

    const captureId = generateId();
    const now = nowISO();
    const searchText = normaliseSearchText([truncated, sourceTitle, domain, note]);

    const capture: Capture = {
      capture_id: captureId,
      type: "text",
      context_id: contextId,
      created_at: now,
      updated_at: now,
      source_url: restricted ? null : sourceUrl,
      source_title: restricted ? null : sourceTitle,
      source_domain: restricted ? null : domain,
      favicon_data: null,
      content_text: truncated,
      code_language: null,
      user_note: note ?? null,
      anchor: anchor ?? null,
      highlight_color: highlightColor ?? null,
      question_state: null,
      incognito: tab?.incognito ?? false,
      deleted_at: null,
      version: 1,
      owner_id: null,
      search_text: searchText,
    };

    await capRepo.create(capture);
    await this.updateContextMetadata(contextId, sourceUrl, sourceTitle);
    try {
      chrome.runtime.sendMessage({ type: "CAPTURE_SAVED", payload: { captureId, contextId } }).catch(() => {});
    } catch {}
    if (tags && tags.length > 0) {
      for (const t of tags) {
        const tag = await tagRepo.getOrCreate(t);
        await tagRepo.linkToCapture(captureId, tag.tag_id);
      }
    }

    logger.info(`Text capture saved: ${captureId} in context ${contextId}`);
    return captureId;
  }

  async listHighlights(sourceUrl: string): Promise<Array<{ capture_id: string; text: string; anchor: { prefix: string; suffix: string } | null; color: string }>> {
    const captures = await capRepo.listBySourceUrl(sourceUrl);
    return captures
      .filter((capture: any) => capture.anchor && capture.content_text)
      .map((capture: any) => ({
        capture_id: capture.capture_id,
        text: capture.content_text,
        anchor: capture.anchor,
        color: capture.highlight_color || "#d1d5db",
      }));
  }

  async updateHighlightColor(captureId: string, color: string): Promise<void> {
    await capRepo.update(captureId, { highlight_color: color });
  }

  async captureNote(input: {
    text: string;
    tabId: number | null;
    windowId: number | null;
    note?: string;
    tags?: string[];
  }): Promise<string> {
    const { text, tabId, windowId, note, tags } = input;
    if (!text || text.trim().length === 0) {
      throw new Error("Empty note");
    }

    let contextId: string;
    let sourceUrl: string | null = null;
    let sourceTitle: string | null = null;
    let domain: string | null = null;
    let incognito = false;

    if (tabId !== null) {
      contextId = await contextLifecycle.getOrCreateForTab(tabId, windowId!);
      const tab = await this.getTabInfo(tabId);
      sourceUrl = tab?.url ?? null;
      sourceTitle = tab?.title ?? null;
      domain = sourceUrl ? extractDomain(sourceUrl) : null;
      incognito = tab?.incognito ?? false;
    } else {
      const archived = await contextLifecycle.listArchived();
      if (archived.length > 0) {
        contextId = archived[0].context_id;
      } else {
        contextId = await this.createUnfiledContext();
      }
    }

    const restricted = sourceUrl ? isRestrictedUrl(sourceUrl) : false;
    const captureId = generateId();
    const now = nowISO();
    const searchText = normaliseSearchText([text, sourceTitle, domain, note]);

    const capture: Capture = {
      capture_id: captureId,
      type: "note",
      context_id: contextId,
      created_at: now,
      updated_at: now,
      source_url: restricted ? null : sourceUrl,
      source_title: restricted ? null : sourceTitle,
      source_domain: restricted ? null : domain,
      favicon_data: null,
      content_text: text,
      code_language: null,
      user_note: note ?? null,
      anchor: null,
      question_state: null,
      incognito: incognito,
      deleted_at: null,
      version: 1,
      owner_id: null,
      search_text: searchText,
    };

    await capRepo.create(capture);
    await this.updateContextMetadata(contextId, sourceUrl, sourceTitle);
    try {
      chrome.runtime.sendMessage({ type: "CAPTURE_SAVED", payload: { captureId, contextId } }).catch(() => {});
    } catch {}
    if (tags && tags.length > 0) {
      for (const t of tags) {
        const tag = await tagRepo.getOrCreate(t);
        await tagRepo.linkToCapture(captureId, tag.tag_id);
      }
    }

    logger.info(`Note capture saved: ${captureId} in context ${contextId}`);
    return captureId;
  }

  async captureQuestion(input: {
    text: string;
    tabId: number | null;
    windowId: number | null;
  }): Promise<string> {
    const { text, tabId, windowId } = input;
    if (!text || text.trim().length === 0) {
      throw new Error("Empty question");
    }

    let contextId: string;
    let sourceUrl: string | null = null;
    let sourceTitle: string | null = null;
    let domain: string | null = null;
    let incognito = false;

    if (tabId !== null) {
      contextId = await contextLifecycle.getOrCreateForTab(tabId, windowId!);
      const tab = await this.getTabInfo(tabId);
      sourceUrl = tab?.url ?? null;
      sourceTitle = tab?.title ?? null;
      domain = sourceUrl ? extractDomain(sourceUrl) : null;
      incognito = tab?.incognito ?? false;
    } else {
      const archived = await contextLifecycle.listArchived();
      contextId = archived.length > 0 ? archived[0].context_id : await this.createUnfiledContext();
    }

    const restricted = sourceUrl ? isRestrictedUrl(sourceUrl) : false;
    const captureId = generateId();
    const now = nowISO();
    const searchText = normaliseSearchText([text, sourceTitle, domain]);

    const capture: Capture = {
      capture_id: captureId,
      type: "question",
      context_id: contextId,
      created_at: now,
      updated_at: now,
      source_url: restricted ? null : sourceUrl,
      source_title: restricted ? null : sourceTitle,
      source_domain: restricted ? null : domain,
      favicon_data: null,
      content_text: text,
      code_language: null,
      user_note: null,
      anchor: null,
      question_state: "open",
      incognito: incognito,
      deleted_at: null,
      version: 1,
      owner_id: null,
      search_text: searchText,
    };

    await capRepo.create(capture);
    await this.updateContextMetadata(contextId, sourceUrl, sourceTitle);
    try {
      chrome.runtime.sendMessage({ type: "CAPTURE_SAVED", payload: { captureId, contextId } }).catch(() => {});
    } catch {}
    logger.info(`Question capture saved: ${captureId}`);
    return captureId;
  }

  async captureLink(input: {
    url: string;
    title?: string;
    tabId: number | null;
    windowId: number | null;
    note?: string;
    tags?: string[];
  }): Promise<string> {
    const { url, title, tabId, windowId, note, tags } = input;
    if (!url) throw new Error("URL required");

    let contextId: string;
    let sourceUrl = url;
    let sourceTitle = title ?? null;
    let domain = extractDomain(sourceUrl);
    let incognito = false;

    if (tabId !== null) {
      contextId = await contextLifecycle.getOrCreateForTab(tabId, windowId!);
      const tab = await this.getTabInfo(tabId);
      incognito = tab?.incognito ?? false;
      if (!sourceTitle && tab?.title) sourceTitle = tab.title;
    } else {
      const archived = await contextLifecycle.listArchived();
      contextId = archived.length > 0 ? archived[0].context_id : await this.createUnfiledContext();
    }

    const restricted = isRestrictedUrl(sourceUrl);
    const captureId = generateId();
    const now = nowISO();
    const searchText = normaliseSearchText([sourceTitle, sourceUrl, domain, note]);
    const isDuplicate = !restricted && await this.checkDuplicateUrl(sourceUrl, contextId);

    // Favicon URL from the tab if available
    let faviconUrl: string | null = null;
    if (tabId !== null) {
      const tab = await this.getTabInfo(tabId);
      faviconUrl = tab?.favIconUrl ?? null;
    }
    if (!faviconUrl && domain) {
      faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    }

    const capture: Capture = {
      capture_id: captureId,
      type: "link",
      context_id: contextId,
      created_at: now,
      updated_at: now,
      source_url: restricted ? null : sourceUrl,
      source_title: restricted ? null : sourceTitle,
      source_domain: restricted ? null : domain,
      favicon_data: null,
      favicon_url: restricted ? null : faviconUrl,
      content_text: null,
      code_language: null,
      user_note: note ?? null,
      anchor: null,
      question_state: null,
      incognito: incognito,
      deleted_at: null,
      version: 1,
      owner_id: null,
      search_text: searchText,
      duplicate_warning: isDuplicate,
    };

    await capRepo.create(capture);
    await this.updateContextMetadata(contextId, sourceUrl, sourceTitle);
    try {
      chrome.runtime.sendMessage({ type: "CAPTURE_SAVED", payload: { captureId, contextId } }).catch(() => {});
    } catch {}
    if (tags && tags.length > 0) {
      for (const t of tags) {
        const tag = await tagRepo.getOrCreate(t);
        await tagRepo.linkToCapture(captureId, tag.tag_id);
      }
    }

    logger.info(`Link capture saved: ${captureId}`);
    return captureId;
  }

  async captureCode(input: {
    text: string;
    language?: string;
    tabId: number;
    windowId: number;
    note?: string;
    tags?: string[];
  }): Promise<string> {
    const { text, language, tabId, windowId, note, tags } = input;
    if (!text || text.trim().length === 0) {
      throw new Error("Empty code selection");
    }

    const contextId = await contextLifecycle.getOrCreateForTab(tabId, windowId);
    const tab = await this.getTabInfo(tabId);
    const sourceUrl = tab?.url ?? null;
    const sourceTitle = tab?.title ?? null;
    const domain = sourceUrl ? extractDomain(sourceUrl) : null;

    const captureId = generateId();
    const now = nowISO();
    const searchText = normaliseSearchText([text, sourceTitle, domain, note, language]);

    const capture: Capture = {
      capture_id: captureId,
      type: "code",
      context_id: contextId,
      created_at: now,
      updated_at: now,
      source_url: sourceUrl,
      source_title: sourceTitle,
      source_domain: domain,
      favicon_data: null,
      content_text: text,
      code_language: language ?? null,
      user_note: note ?? null,
      anchor: null,
      question_state: null,
      incognito: tab?.incognito ?? false,
      deleted_at: null,
      version: 1,
      owner_id: null,
      search_text: searchText,
    };

    await capRepo.create(capture);
    await this.updateContextMetadata(contextId, sourceUrl, sourceTitle);
    try {
      chrome.runtime.sendMessage({ type: "CAPTURE_SAVED", payload: { captureId, contextId } }).catch(() => {});
    } catch {}
    if (tags && tags.length > 0) {
      for (const t of tags) {
        const tag = await tagRepo.getOrCreate(t);
        await tagRepo.linkToCapture(captureId, tag.tag_id);
      }
    }

    logger.info(`Code capture saved: ${captureId}`);
    return captureId;
  }

  async captureScreenshot(input: {
    tabId: number;
    windowId: number;
    note?: string;
    tags?: string[];
  }): Promise<string> {
    const { tabId, windowId, note, tags } = input;
    const tab = await this.getTabInfo(tabId);
    if (!tab) throw new Error("Tab not found");

    if (tab.url && isRestrictedUrl(tab.url)) {
      throw createRestrictedPageError("Restricted page");
    }

    const contextId = await contextLifecycle.getOrCreateForTab(tabId, windowId);

    try {
      const imageData = await chrome.tabs.captureVisibleTab(windowId, { format: "png" });
      if (!imageData) throw new Error("No image data returned");

      const response = await fetch(imageData);
      const buffer = await response.arrayBuffer();
      const sha256 = await this.computeSha256(buffer);
      const existing = await attRepo.getBySha256(sha256);

      let attachmentId: string;
      if (existing) {
        attachmentId = existing.attachment_id;
      } else {
        const blob = new Blob([buffer], { type: "image/png" });
        await attRepo.create({
          attachment_id: crypto.randomUUID(),
          sha256,
          mime: "image/png",
          size: buffer.byteLength,
          width: null,
          height: null,
          blob,
          thumb: null,
        });
        const found = await attRepo.getBySha256(sha256);
        attachmentId = found!.attachment_id;
      }

      const captureId = generateId();
      const now = nowISO();
      const searchText = normaliseSearchText([tab.title, tab.url ? new URL(tab.url).hostname : null, note]);

      const capture: Capture = {
        capture_id: captureId,
        type: "screenshot",
        context_id: contextId,
        created_at: now,
        updated_at: now,
        source_url: tab.url ?? null,
        source_title: tab.title ?? null,
        source_domain: tab.url ? new URL(tab.url).hostname : null,
        favicon_data: null,
        favicon_url: tab.favIconUrl ?? (tab.url ? `https://www.google.com/s2/favicons?domain=${new URL(tab.url).hostname}&sz=32` : null),
        content_text: null,
        code_language: null,
        user_note: note ?? null,
        anchor: null,
        question_state: null,
        incognito: tab.incognito ?? false,
        deleted_at: null,
        version: 1,
        owner_id: null,
        search_text: searchText,
        attachment_ids: [attachmentId],
      };

      await capRepo.create(capture);
      await this.updateContextMetadata(contextId, tab.url ?? null, tab.title ?? null);
      try {
        chrome.runtime.sendMessage({ type: "CAPTURE_SAVED", payload: { captureId, contextId } }).catch(() => {});
      } catch {}
      await attRepo.linkToCapture(captureId, attachmentId, "original", 0);

      if (tags && tags.length > 0) {
        for (const t of tags) {
          const tag = await tagRepo.getOrCreate(t);
          await tagRepo.linkToCapture(captureId, tag.tag_id);
        }
      }

      logger.info(`Screenshot capture saved: ${captureId}`);
      return captureId;
    } catch (err) {
      logger.error(`Screenshot capture failed: ${err}`);
      throw createCaptureError(String(err));
    }
  }

  private async getTabInfo(tabId: number): Promise<chrome.tabs.Tab | null> {
    try {
      return await chrome.tabs.get(tabId);
    } catch {
      return null;
    }
  }

  private async getBlocklist(): Promise<string[]> {
    const raw = await settingsStore.get("domain_blocklist");
    if (!raw) return [];
    return raw.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
  }

  async isDomainBlocked(domain: string | null): Promise<boolean> {
    if (!domain) return false;
    const blocklist = await this.getBlocklist();
    return blocklist.some((b) => domain.toLowerCase().includes(b));
  }

  private async checkDuplicateUrl(url: string | null, contextId: string): Promise<boolean> {
    if (!url) return false;
    try {
      const existing = await capRepo.listAll({ limit: 50000 });
      return existing.some((c) => c.source_url === url && c.deleted_at === null);
    } catch {
      return false;
    }
  }

  private async createUnfiledContext(): Promise<string> {
    const now = nowISO();
    const contextId = generateId();
    await ctxRepo.create({
      context_id: contextId,
      title: "Unfiled",
      status: "active",
      created_at: now,
      last_active_at: now,
      first_url: null,
      last_url: null,
      deleted_at: null,
      version: 1,
      owner_id: null,
    });
    return contextId;
  }

  private async computeSha256(buffer: ArrayBuffer): Promise<string> {
    const hash = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  private async updateContextMetadata(contextId: string, url: string | null, title: string | null): Promise<void> {
    try {
      if (!contextId) return;
      const ctx = await ctxRepo.get(contextId);
      if (!ctx) return;
      const updates: any = { last_active_at: nowISO() };
      if (url) {
        if (!ctx.first_url) updates.first_url = url;
        updates.last_url = url;
      }
      if (title && (!ctx.title || ctx.title === "New Context")) {
        updates.title = title;
      }
      await ctxRepo.update(contextId, updates);
    } catch (err) {
      logger.warn("Failed to update context metadata", String(err));
    }
  }
}

export const capturePipeline = new CapturePipeline();