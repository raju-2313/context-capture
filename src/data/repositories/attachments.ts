import { getDatabase, tx, objectStore } from "../db";

export class AttachmentRepository {
  async create(attachment: any): Promise<any> {
    const record = { ...attachment, thumb: attachment.thumb ?? null };
    await tx(["attachments"], "readwrite", (t) => {
      objectStore(t, "attachments").add(record);
      return Promise.resolve();
    });
    return record;
  }

  async get(attachmentId: string): Promise<any | null> {
    return tx(["attachments"], "readonly", (t) => {
      return new Promise<any | null>((resolve) => {
        const req = objectStore(t, "attachments").get(attachmentId);
        req.onsuccess = () => resolve(req.result ?? null);
      });
    });
  }

  async getBySha256(sha256: string): Promise<any | null> {
    return tx(["attachments"], "readonly", (t) => {
      const index = objectStore(t, "attachments").index("by-sha256");
      return new Promise<any | null>((resolve) => {
        const req = index.get(IDBKeyRange.only(sha256));
        req.onsuccess = () => resolve(req.result ?? null);
      });
    });
  }

  async linkToCapture(captureId: string, attachmentId: string, role: string, position: number): Promise<void> {
    await tx(["capture_attachments"], "readwrite", (t) => {
      objectStore(t, "capture_attachments").add({
        capture_id: captureId,
        attachment_id: attachmentId,
        role,
        position,
      });
      return Promise.resolve();
    });
  }

  async getAttachmentsForCapture(captureId: string): Promise<any[]> {
    return tx(["capture_attachments", "attachments"], "readonly", async (t) => {
      const caStore = objectStore(t, "capture_attachments");
      const index = caStore.index("by-capture");
      const joins = await new Promise<any[]>((resolve) => {
        const req = index.getAll(IDBKeyRange.only(captureId));
        req.onsuccess = () => resolve(req.result || []);
      });
      const attStore = objectStore(t, "attachments");
      const attachments: any[] = [];
      for (const join of joins) {
        const att = await new Promise<any | null>((resolve) => {
          const req = attStore.get(join.attachment_id);
          req.onsuccess = () => resolve(req.result ?? null);
        });
        if (att) attachments.push(att);
      }
      return attachments.sort((a, b) => (a.position || 0) - (b.position || 0));
    });
  }

  async count(): Promise<number> {
    return tx(["attachments"], "readonly", (t) => {
      return new Promise<number>((resolve) => {
        const req = objectStore(t, "attachments").count();
        req.onsuccess = () => resolve(req.result);
      });
    });
  }
}

export const attachments = new AttachmentRepository();