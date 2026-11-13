export interface ContextLifecycle {
  getOrCreateForTab(tabId: number, windowId: number): Promise<string>;
  getContextForTab(tabId: number): Promise<string | null>;
  bindTabToContext(tabId: number, windowId: number, contextId: string): Promise<void>;
  unbindTab(tabId: number): Promise<void>;
  archiveContext(contextId: string): Promise<void>;
  restoreContext(contextId: string): Promise<void>;
  listActive(): Promise<Array<{ context_id: string; title: string; status: "active" | "archived"; capture_count: number; last_url: string | null; last_active_at: string; created_at?: string }>>;
  listArchived(): Promise<Array<{ context_id: string; title: string; status: "active" | "archived"; capture_count: number; last_url: string | null; last_active_at: string; created_at?: string }>>;
  renameContext(contextId: string, title: string): Promise<void>;
  deleteContext(contextId: string): Promise<void>;
  mergeContexts(sourceId: string, targetId: string): Promise<void>;
  rebindToTab(contextId: string, tabId: number, windowId: number): Promise<void>;
  onTabClosed(tabId: number): Promise<void>;
  onTabActivated(tabId: number, windowId: number): Promise<void>;
  reconcileOnStartup(): Promise<void>;
}

import { contexts as ctxRepo, captures as capRepo } from "../../data/repositories";
import { sessionStore } from "../../data/sessionStore";
import { generateId, nowISO, ContextRecord } from "../../shared/types";
import { logger } from "../../shared/logger";

class ContextLifecycleImpl implements ContextLifecycle {
  async getOrCreateForTab(tabId: number, windowId: number): Promise<string> {
    const existing = await sessionStore.getBinding(tabId);
    if (existing) {
      await this.updateLastActive(existing.context_id);
      return existing.context_id;
    }

    const contextId = generateId();
    const now = nowISO();
    const context: ContextRecord = {
      context_id: contextId,
      title: "New Context",
      status: "active",
      created_at: now,
      last_active_at: now,
      first_url: null,
      last_url: null,
      deleted_at: null,
      version: 1,
      owner_id: null,
    };
    await ctxRepo.create(context);
    await sessionStore.setBinding(tabId, { context_id: contextId, window_id: windowId, bound_at: Date.now() });
    logger.info(`Created context ${contextId} for tab ${tabId}`);
    return contextId;
  }

  async getContextForTab(tabId: number): Promise<string | null> {
    const binding = await sessionStore.getBinding(tabId);
    return binding?.context_id ?? null;
  }

  async bindTabToContext(tabId: number, windowId: number, contextId: string): Promise<void> {
    const existingBinding = await sessionStore.getBinding(tabId);
    if (existingBinding && existingBinding.context_id === contextId) return;

    const otherTab = await this.findTabBoundToContext(contextId);
    if (otherTab !== null && otherTab !== tabId) {
      throw new Error(`Context ${contextId} is already bound to tab ${otherTab}`);
    }

    await sessionStore.setBinding(tabId, { context_id: contextId, window_id: windowId, bound_at: Date.now() });
    await this.updateLastActive(contextId);
  }

  async unbindTab(tabId: number): Promise<void> {
    await sessionStore.removeBinding(tabId);
  }

  async archiveContext(contextId: string): Promise<void> {
    await ctxRepo.update(contextId, { status: "archived" });
  }

  async restoreContext(contextId: string): Promise<void> {
    await ctxRepo.update(contextId, { status: "active" });
  }

  async listActive(): Promise<Array<{ context_id: string; title: string; status: "active" | "archived"; capture_count: number; last_url: string | null; last_active_at: string; created_at?: string }>> {
    const all = await ctxRepo.list({ status: "active" });
    const result = [];
    for (const ctx of all) {
      const count = (await capRepo.listByContext(ctx.context_id)).length;
      result.push({
        context_id: ctx.context_id,
        title: ctx.title,
        status: (ctx.status || "active") as "active" | "archived",
        capture_count: count,
        last_url: ctx.last_url,
        last_active_at: ctx.last_active_at,
        created_at: ctx.created_at,
      });
    }
    return result.sort((a, b) => new Date(b.last_active_at).getTime() - new Date(a.last_active_at).getTime());
  }

  async listArchived(): Promise<Array<{ context_id: string; title: string; status: "active" | "archived"; capture_count: number; last_url: string | null; last_active_at: string; created_at?: string }>> {
    const all = await ctxRepo.list({ status: "archived" });
    const result = [];
    for (const ctx of all) {
      const count = (await capRepo.listByContext(ctx.context_id)).length;
      result.push({
        context_id: ctx.context_id,
        title: ctx.title,
        status: (ctx.status || "archived") as "active" | "archived",
        capture_count: count,
        last_url: ctx.last_url,
        last_active_at: ctx.last_active_at,
        created_at: ctx.created_at,
      });
    }
    return result.sort((a, b) => new Date(b.last_active_at).getTime() - new Date(a.last_active_at).getTime());
  }

  async renameContext(contextId: string, title: string): Promise<void> {
    await ctxRepo.update(contextId, { title });
  }

  async deleteContext(contextId: string): Promise<void> {
    await ctxRepo.softDelete(contextId);
  }

  async mergeContexts(sourceId: string, targetId: string): Promise<void> {
    const captures = await capRepo.listByContext(sourceId);
    for (const cap of captures) {
      await capRepo.update(cap.capture_id, { context_id: targetId });
    }
    await ctxRepo.softDelete(sourceId);
  }

  async rebindToTab(contextId: string, tabId: number, windowId: number): Promise<void> {
    await this.bindTabToContext(tabId, windowId, contextId);
    await ctxRepo.update(contextId, { status: "active" });
  }

  async onTabClosed(tabId: number): Promise<void> {
    const binding = await sessionStore.getBinding(tabId);
    if (binding) {
      await this.archiveContext(binding.context_id);
      await sessionStore.removeBinding(tabId);
    }
  }

  async onTabActivated(tabId: number): Promise<void> {
    const binding = await sessionStore.getBinding(tabId);
    if (binding) {
      await this.updateLastActive(binding.context_id);
    }
  }

  async reconcileOnStartup(): Promise<void> {
    const bindings = await sessionStore.getBindings();
    const activeContexts = await ctxRepo.list({ status: "active" });
    for (const ctx of activeContexts) {
      const stillBound = Object.values(bindings).some((b) => b.context_id === ctx.context_id);
      if (!stillBound) {
        await this.archiveContext(ctx.context_id);
      }
    }
    logger.info("Startup reconciliation complete");
  }

  private async updateLastActive(contextId: string): Promise<void> {
    await ctxRepo.update(contextId, { last_active_at: nowISO() });
  }

  private async findTabBoundToContext(contextId: string): Promise<number | null> {
    const bindings = await sessionStore.getBindings();
    for (const [tabId, binding] of Object.entries(bindings)) {
      if (binding.context_id === contextId) return parseInt(tabId, 10);
    }
    return null;
  }
}

export const contextLifecycle = new ContextLifecycleImpl();