import { getDatabase, tx, objectStore } from "../db";

export class ContextRepository {
  async create(context: any): Promise<any> {
    const record = { ...context, version: 1, deleted_at: null };
    await tx(["contexts"], "readwrite", (t) => {
      objectStore(t, "contexts").add(record);
      return Promise.resolve();
    });
    return record;
  }

  async get(contextId: string): Promise<any | null> {
    return tx(["contexts"], "readonly", (t) => {
      return new Promise<any | null>((resolve) => {
        const req = objectStore(t, "contexts").get(contextId);
        req.onsuccess = () => resolve(req.result ?? null);
      });
    });
  }

  async list(options?: { status?: "active" | "archived"; includeDeleted?: boolean }): Promise<any[]> {
    return tx(["contexts"], "readonly", (t) => {
      const store = objectStore(t, "contexts");
      const index = options?.status ? store.index("by-status") : store;
      const range = options?.status ? IDBKeyRange.only(options.status) : null;
      return new Promise<any[]>((resolve) => {
        const req = index.getAll(range);
        req.onsuccess = () => {
          let results = req.result || [];
          if (!options?.includeDeleted) {
            results = results.filter((r: any) => r.deleted_at === null);
          }
          resolve(results);
        };
      });
    });
  }

  async update(contextId: string, updates: Partial<any>): Promise<void> {
    const existing = await this.get(contextId);
    if (!existing) throw new Error(`Context ${contextId} not found`);
    const changedFields = Object.keys(updates);
    const record = { ...existing, ...updates, version: existing.version + 1 };
    await tx(["contexts"], "readwrite", (t) => {
      objectStore(t, "contexts").put(record);
      return Promise.resolve();
    });
  }

  async softDelete(contextId: string): Promise<void> {
    const existing = await this.get(contextId);
    if (!existing) return;
    const record = { ...existing, deleted_at: new Date().toISOString(), version: existing.version + 1 };
    await tx(["contexts"], "readwrite", (t) => {
      objectStore(t, "contexts").put(record);
      return Promise.resolve();
    });
  }

  async count(): Promise<number> {
    return tx(["contexts"], "readonly", (t) => {
      return new Promise<number>((resolve) => {
        const req = objectStore(t, "contexts").count();
        req.onsuccess = () => resolve(req.result);
      });
    });
  }
}

export const contexts = new ContextRepository();