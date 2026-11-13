import { tx, objectStore } from "../db";
import { ProjectRecord, ProjectMembershipRecord, Capture, generateId, nowISO } from "../../shared/types";
import { captures as capRepo } from "./captures";

export class ProjectRepository {
  async create(input: { title: string; description?: string; accent_color?: string }): Promise<ProjectRecord> {
    const id = generateId();
    const now = nowISO();
    const record: ProjectRecord = {
      project_id: id,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      accent_color: input.accent_color || "#DFFF00",
      status: "active",
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version: 1,
      owner_id: null,
    };

    await tx(["projects"], "readwrite", (t) => {
      objectStore(t, "projects").add(record);
      return Promise.resolve();
    });

    return record;
  }

  async get(projectId: string): Promise<ProjectRecord | null> {
    return tx(["projects"], "readonly", (t) => {
      return new Promise<ProjectRecord | null>((resolve) => {
        const req = objectStore(t, "projects").get(projectId);
        req.onsuccess = () => resolve(req.result ?? null);
      });
    });
  }

  async list(options?: { status?: "active" | "archived"; includeDeleted?: boolean }): Promise<ProjectRecord[]> {
    return tx(["projects"], "readonly", (t) => {
      const store = objectStore(t, "projects");
      const index = options?.status ? store.index("by-status") : store;
      const range = options?.status ? IDBKeyRange.only(options.status) : null;
      return new Promise<ProjectRecord[]>((resolve) => {
        const req = index.getAll(range);
        req.onsuccess = () => {
          let results = req.result || [];
          if (!options?.includeDeleted) {
            results = results.filter((r: any) => r.deleted_at === null);
          }
          resolve(results.sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()));
        };
      });
    });
  }

  async update(projectId: string, updates: Partial<ProjectRecord>): Promise<void> {
    const existing = await this.get(projectId);
    if (!existing) throw new Error(`Project ${projectId} not found`);
    const record = {
      ...existing,
      ...updates,
      updated_at: nowISO(),
      version: existing.version + 1,
    };
    await tx(["projects"], "readwrite", (t) => {
      objectStore(t, "projects").put(record);
      return Promise.resolve();
    });
  }

  async softDelete(projectId: string): Promise<void> {
    await this.update(projectId, { deleted_at: nowISO() });
  }

  async permanentDelete(projectId: string): Promise<void> {
    await tx(["projects", "project_memberships"], "readwrite", (t) => {
      objectStore(t, "projects").delete(projectId);

      const store = objectStore(t, "project_memberships");
      const index = store.index("by-project");
      const req = index.getAll(IDBKeyRange.only(projectId));
      req.onsuccess = () => {
        for (const m of (req.result || [])) {
          store.delete([m.project_id, m.capture_id]);
        }
      };

      return Promise.resolve();
    });
  }

  async permanentDeleteMany(projectIds: string[]): Promise<void> {
    for (const id of projectIds) {
      await this.permanentDelete(id);
    }
  }

  async addCapture(projectId: string, captureId: string, itemNote?: string, section?: string): Promise<ProjectMembershipRecord> {
    const existing = await this.listMemberships(projectId);
    const existingMembership = existing.find((m) => m.capture_id === captureId && !m.deleted_at);
    if (existingMembership) return existingMembership;

    const orderKey = existing.length + 1;
    const membership: ProjectMembershipRecord = {
      project_id: projectId,
      capture_id: captureId,
      order_key: orderKey,
      section: section || null,
      item_note: itemNote || null,
      added_at: nowISO(),
      deleted_at: null,
    };

    await tx(["project_memberships"], "readwrite", (t) => {
      objectStore(t, "project_memberships").put(membership);
      return Promise.resolve();
    });

    // Update project updated_at
    await this.update(projectId, {});

    return membership;
  }

  async removeCapture(projectId: string, captureId: string): Promise<void> {
    await tx(["project_memberships"], "readwrite", (t) => {
      objectStore(t, "project_memberships").delete([projectId, captureId]);
      return Promise.resolve();
    });
    await this.update(projectId, {});
  }

  async listMemberships(projectId: string): Promise<ProjectMembershipRecord[]> {
    return tx(["project_memberships"], "readonly", (t) => {
      const index = objectStore(t, "project_memberships").index("by-project");
      return new Promise<ProjectMembershipRecord[]>((resolve) => {
        const req = index.getAll(IDBKeyRange.only(projectId));
        req.onsuccess = () => {
          const results = (req.result || []).filter((m: any) => !m.deleted_at);
          resolve(results.sort((a: any, b: any) => a.order_key - b.order_key));
        };
      });
    });
  }

  async listCaptures(projectId: string): Promise<Capture[]> {
    const memberships = await this.listMemberships(projectId);
    const captures: Capture[] = [];
    for (const m of memberships) {
      const cap = await capRepo.get(m.capture_id);
      if (cap && !cap.deleted_at) {
        captures.push(cap);
      }
    }
    return captures;
  }

  async listProjectsForCapture(captureId: string): Promise<ProjectRecord[]> {
    const memberships = await tx(["project_memberships"], "readonly", (t) => {
      const index = objectStore(t, "project_memberships").index("by-capture");
      return new Promise<ProjectMembershipRecord[]>((resolve) => {
        const req = index.getAll(IDBKeyRange.only(captureId));
        req.onsuccess = () => resolve(req.result || []);
      });
    });

    const activeMemberships = memberships.filter((m) => !m.deleted_at);
    const projects: ProjectRecord[] = [];
    for (const m of activeMemberships) {
      const p = await this.get(m.project_id);
      if (p && !p.deleted_at) {
        projects.push(p);
      }
    }
    return projects;
  }

  async count(): Promise<number> {
    return tx(["projects"], "readonly", (t) => {
      return new Promise<number>((resolve) => {
        const req = objectStore(t, "projects").count();
        req.onsuccess = () => resolve(req.result);
      });
    });
  }
}

export const projects = new ProjectRepository();

