import { getDatabase, tx, objectStore } from "../db";

export class JournalRepository {
  async list(options?: { entityType?: string; since?: number }): Promise<any[]> {
    return tx(["change_journal"], "readonly", (t) => {
      return new Promise<any[]>((resolve) => {
        const req = objectStore(t, "change_journal").getAll();
        req.onsuccess = () => {
          let results = req.result || [];
          if (options?.entityType) results = results.filter((e: any) => e.entity_type === options.entityType);
          if (options?.since !== undefined) results = results.filter((e: any) => e.seq > options.since!);
          resolve(results.sort((a: any, b: any) => a.seq - b.seq));
        };
      });
    });
  }

  async getLastSeq(): Promise<number> {
    const all = await this.list();
    return all.length > 0 ? Math.max(...all.map((e: any) => e.seq)) : 0;
  }

  async write(entityType: string, entityId: string, op: "create" | "update" | "delete", changedFields: string[] | null, deviceId: string): Promise<void> {
    const seq = await this.getLastSeq() + 1;
    const entry = {
      seq,
      entity_type: entityType,
      entity_id: entityId,
      op,
      changed_fields: changedFields,
      at: new Date().toISOString(),
      device_id: deviceId,
    };
    await tx(["change_journal"], "readwrite", (t) => {
      objectStore(t, "change_journal").add(entry);
      return Promise.resolve();
    });
  }
}

export const journal = new JournalRepository();