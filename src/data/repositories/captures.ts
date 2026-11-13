import { getDatabase, tx, objectStore } from "../db";

export class CaptureRepository {
  async create(capture: any): Promise<any> {
    const record = { ...capture, version: 1, deleted_at: null };
    await tx(["captures"], "readwrite", (t) => {
      objectStore(t, "captures").add(record);
      return Promise.resolve();
    });
    return record;
  }

  async get(captureId: string): Promise<any | null> {
    return tx(["captures"], "readonly", (t) => {
      return new Promise<any | null>((resolve) => {
        const req = objectStore(t, "captures").get(captureId);
        req.onsuccess = () => resolve(req.result ?? null);
      });
    });
  }

  async listByContext(contextId: string): Promise<any[]> {
    return tx(["captures"], "readonly", (t) => {
      const index = objectStore(t, "captures").index("by-context");
      return new Promise<any[]>((resolve) => {
        const req = index.getAll(IDBKeyRange.only(contextId));
        req.onsuccess = () => resolve((req.result || []).filter((c: any) => c.deleted_at === null));
      });
    });
  }

  async listAll(options?: { limit?: number; offset?: number }): Promise<any[]> {
    return tx(["captures"], "readonly", (t) => {
      return new Promise<any[]>((resolve) => {
        const req = objectStore(t, "captures").getAll();
        req.onsuccess = () => {
          let results = (req.result || []).filter((c: any) => c.deleted_at === null);
          results.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          if (options?.offset) results.splice(0, options.offset);
          if (options?.limit) results.splice(options.limit);
          resolve(results);
        };
      });
    });
  }

  async update(captureId: string, updates: Partial<any>): Promise<void> {
    const existing = await this.get(captureId);
    if (!existing) throw new Error(`Capture ${captureId} not found`);
    const changedFields = Object.keys(updates);
    const record = { ...existing, ...updates, version: existing.version + 1 };
    await tx(["captures"], "readwrite", (t) => {
      objectStore(t, "captures").put(record);
      return Promise.resolve();
    });
  }

  async softDelete(captureId: string): Promise<void> {
    const existing = await this.get(captureId);
    if (!existing) return;
    const record = { ...existing, deleted_at: new Date().toISOString(), version: existing.version + 1 };
    await tx(["captures"], "readwrite", (t) => {
      objectStore(t, "captures").put(record);
      return Promise.resolve();
    });
  }

  async permanentDelete(captureId: string): Promise<void> {
    await tx(["captures", "capture_tags", "capture_attachments", "project_memberships"], "readwrite", (t) => {
      objectStore(t, "captures").delete(captureId);

      const ctStore = objectStore(t, "capture_tags");
      const ctIndex = ctStore.index("by-capture");
      const ctReq = ctIndex.getAll(IDBKeyRange.only(captureId));
      ctReq.onsuccess = () => {
        for (const row of (ctReq.result || [])) {
          ctStore.delete([row.capture_id, row.tag_id]);
        }
      };

      const caStore = objectStore(t, "capture_attachments");
      const caIndex = caStore.index("by-capture");
      const caReq = caIndex.getAll(IDBKeyRange.only(captureId));
      caReq.onsuccess = () => {
        for (const row of (caReq.result || [])) {
          caStore.delete([row.capture_id, row.attachment_id]);
        }
      };

      const pmStore = objectStore(t, "project_memberships");
      const pmIndex = pmStore.index("by-capture");
      const pmReq = pmIndex.getAll(IDBKeyRange.only(captureId));
      pmReq.onsuccess = () => {
        for (const row of (pmReq.result || [])) {
          pmStore.delete([row.project_id, row.capture_id]);
        }
      };

      return Promise.resolve();
    });
  }

  async permanentDeleteMany(captureIds: string[]): Promise<void> {
    for (const id of captureIds) {
      await this.permanentDelete(id);
    }
  }

  async count(): Promise<number> {
    return tx(["captures"], "readonly", (t) => {
      return new Promise<number>((resolve) => {
        const req = objectStore(t, "captures").count();
        req.onsuccess = () => resolve(req.result);
      });
    });
  }
}

export const captures = new CaptureRepository();