import { getDatabase, tx, objectStore } from "../db";

export class TagRepository {
  async create(tag: any): Promise<any> {
    const record = { tag_id: crypto.randomUUID(), ...tag };
    await tx(["tags"], "readwrite", (t) => {
      objectStore(t, "tags").add(record);
      return Promise.resolve();
    });
    return record;
  }

  async getOrCreate(name: string): Promise<any> {
    const normalised = name.toLowerCase().trim();
    const existing = await tx(["tags"], "readonly", (t) => {
      const index = objectStore(t, "tags").index("by-name");
      return new Promise<any | null>((resolve) => {
        const req = index.get(IDBKeyRange.only(normalised));
        req.onsuccess = () => resolve(req.result ?? null);
      });
    });
    if (existing) return existing;
    return this.create({ name: normalised, display_name: name.trim() });
  }

  async list(): Promise<any[]> {
    return tx(["tags"], "readonly", (t) => {
      return new Promise<any[]>((resolve) => {
        const req = objectStore(t, "tags").getAll();
        req.onsuccess = () => resolve(req.result || []);
      });
    });
  }

  async linkToCapture(captureId: string, tagId: string): Promise<void> {
    await tx(["capture_tags"], "readwrite", (t) => {
      objectStore(t, "capture_tags").add({
        capture_id: captureId,
        tag_id: tagId,
        added_at: new Date().toISOString(),
      });
      return Promise.resolve();
    });
  }

  async unlinkFromCapture(captureId: string, tagId: string): Promise<void> {
    await tx(["capture_tags"], "readwrite", (t) => {
      const index = objectStore(t, "capture_tags").index("by-capture");
      return new Promise<void>((resolve) => {
        const req = index.getAll(IDBKeyRange.only(captureId));
        req.onsuccess = async () => {
          const joins = req.result || [];
          for (const join of joins) {
            if (join.tag_id === tagId) {
              objectStore(t, "capture_tags").delete([captureId, tagId]);
            }
          }
          resolve();
        };
      });
    });
  }

  async getTagsForCapture(captureId: string): Promise<any[]> {
    return tx(["capture_tags", "tags"], "readonly", async (t) => {
      const ctStore = objectStore(t, "capture_tags");
      const index = ctStore.index("by-capture");
      const joins = await new Promise<any[]>((resolve) => {
        const req = index.getAll(IDBKeyRange.only(captureId));
        req.onsuccess = () => resolve(req.result || []);
      });
      const tagStore = objectStore(t, "tags");
      const tags: any[] = [];
      for (const join of joins) {
        const tag = await new Promise<any | null>((resolve) => {
          const req = tagStore.get(join.tag_id);
          req.onsuccess = () => resolve(req.result ?? null);
        });
        if (tag) tags.push(tag);
      }
      return tags;
    });
  }
}

export const tags = new TagRepository();