import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { openDatabase, closeDatabase } from "../../src/data/db";
import { projects } from "../../src/data/repositories/projects";
import { captures } from "../../src/data/repositories/captures";
import { contexts } from "../../src/data/repositories/contexts";
import { generateId, nowISO } from "../../src/shared/types";

describe("Phase 2A: Projects Layer", () => {
  beforeEach(async () => {
    await openDatabase();
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it("creates, reads, updates, and soft-deletes a project", async () => {
    const project = await projects.create({
      title: "EV Research",
      description: "Electric vehicle research notes",
    });

    expect(project.project_id).toBeDefined();
    expect(project.title).toBe("EV Research");
    expect(project.status).toBe("active");

    const fetched = await projects.get(project.project_id);
    expect(fetched).not.toBeNull();
    expect(fetched!.description).toBe("Electric vehicle research notes");

    await projects.update(project.project_id, { title: "EV & Battery Tech" });
    const updated = await projects.get(project.project_id);
    expect(updated!.title).toBe("EV & Battery Tech");
    expect(updated!.version).toBe(2);

    await projects.softDelete(project.project_id);
    const activeProjects = await projects.list();
    expect(activeProjects.some((p) => p.project_id === project.project_id)).toBe(false);
  });

  it("adds captures from different contexts to a project (many-to-many references)", async () => {
    // Create contexts
    const ctxA = await contexts.create({
      context_id: generateId(),
      title: "Tab A",
      status: "active",
      created_at: nowISO(),
      last_active_at: nowISO(),
      first_url: null,
      last_url: null,
      deleted_at: null,
      version: 1,
      owner_id: null,
    });

    const ctxB = await contexts.create({
      context_id: generateId(),
      title: "Tab B",
      status: "active",
      created_at: nowISO(),
      last_active_at: nowISO(),
      first_url: null,
      last_url: null,
      deleted_at: null,
      version: 1,
      owner_id: null,
    });

    // Create captures in different contexts
    const cap1 = await captures.create({
      capture_id: generateId(),
      type: "text",
      context_id: ctxA.context_id,
      created_at: nowISO(),
      updated_at: nowISO(),
      source_url: "https://example.com/battery",
      source_title: "Battery Chemistry",
      source_domain: "example.com",
      favicon_data: null,
      content_text: "Solid state batteries offer 2x energy density",
      code_language: null,
      user_note: null,
      anchor: null,
      question_state: null,
      incognito: false,
      deleted_at: null,
      version: 1,
      owner_id: null,
      search_text: "battery chemistry",
    });

    const cap2 = await captures.create({
      capture_id: generateId(),
      type: "link",
      context_id: ctxB.context_id,
      created_at: nowISO(),
      updated_at: nowISO(),
      source_url: "https://example.com/motors",
      source_title: "Electric Motors",
      source_domain: "example.com",
      favicon_data: null,
      content_text: "Axial flux motor architecture",
      code_language: null,
      user_note: "Check rotor cooling",
      anchor: null,
      question_state: null,
      incognito: false,
      deleted_at: null,
      version: 1,
      owner_id: null,
      search_text: "electric motors",
    });

    // Create two projects
    const p1 = await projects.create({ title: "Powertrain" });
    const p2 = await projects.create({ title: "Materials Science" });

    // Add cap1 to both projects (referential many-to-many, never copied)
    await projects.addCapture(p1.project_id, cap1.capture_id, "Important for range");
    await projects.addCapture(p2.project_id, cap1.capture_id, "Solid-state material");
    await projects.addCapture(p1.project_id, cap2.capture_id);

    // List captures for project 1
    const p1Captures = await projects.listCaptures(p1.project_id);
    expect(p1Captures.length).toBe(2);
    expect(p1Captures.map((c) => c.capture_id)).toContain(cap1.capture_id);
    expect(p1Captures.map((c) => c.capture_id)).toContain(cap2.capture_id);

    // List captures for project 2
    const p2Captures = await projects.listCaptures(p2.project_id);
    expect(p2Captures.length).toBe(1);
    expect(p2Captures[0].capture_id).toBe(cap1.capture_id);

    // Check projects referencing cap1
    const referencingProjects = await projects.listProjectsForCapture(cap1.capture_id);
    expect(referencingProjects.length).toBe(2);

    // Remove cap1 from project 1
    await projects.removeCapture(p1.project_id, cap1.capture_id);
    const p1AfterRemoval = await projects.listCaptures(p1.project_id);
    expect(p1AfterRemoval.length).toBe(1);
    expect(p1AfterRemoval[0].capture_id).toBe(cap2.capture_id);

    // cap1 still exists in project 2 and in original context
    const p2AfterRemoval = await projects.listCaptures(p2.project_id);
    expect(p2AfterRemoval.length).toBe(1);
    const originalCapture = await captures.get(cap1.capture_id);
    expect(originalCapture).not.toBeNull();
  });
});
