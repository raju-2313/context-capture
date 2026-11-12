import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { openDatabase, closeDatabase, getDatabase, tx, objectStore } from "../../src/data/db";
import { contexts } from "../../src/data/repositories/contexts";
import { captures } from "../../src/data/repositories/captures";
import { attachments } from "../../src/data/repositories/attachments";
import { tags } from "../../src/data/repositories/tags";
import { journal } from "../../src/data/repositories/journal";
import { generateId, normaliseSearchText, extractDomain, sanitiseFilename } from "../../src/shared/types";
import { stripDiacritics } from "../../src/shared/types";

describe("Database layer", () => {
  beforeEach(async () => {
    await openDatabase();
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it("opens and closes database", async () => {
    const db = await getDatabase();
    expect(db).toBeDefined();
    expect(db.name).toBe("cc");
  });

  it("context CRUD", async () => {
    const id = generateId();
    const created = await contexts.create({
      context_id: id,
      title: "Test Context",
      status: "active",
      created_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
      first_url: null,
      last_url: null,
      deleted_at: null,
      version: 1,
      owner_id: null,
    });
    expect(created.context_id).toBe(id);
    expect(created.title).toBe("Test Context");

    const fetched = await contexts.get(id);
    expect(fetched).not.toBeNull();
    expect(fetched!.title).toBe("Test Context");

    await contexts.update(id, { title: "Updated" });
    const updated = await contexts.get(id);
    expect(updated!.title).toBe("Updated");
    expect(updated!.version).toBe(2);

    await contexts.softDelete(id);
    const deleted = await contexts.get(id);
    expect(deleted!.deleted_at).not.toBeNull();
  });

  it("capture CRUD", async () => {
    const contextId = generateId();
    await contexts.create({
      context_id: contextId,
      title: "Ctx",
      status: "active",
      created_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
      first_url: null,
      last_url: null,
      deleted_at: null,
      version: 1,
      owner_id: null,
    });

    const captureId = generateId();
    const created = await captures.create({
      capture_id: captureId,
      type: "text",
      context_id: contextId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      source_url: "https://example.com",
      source_title: "Example",
      source_domain: "example.com",
      favicon_data: null,
      content_text: "Hello world",
      code_language: null,
      user_note: null,
      anchor: null,
      question_state: null,
      incognito: false,
      deleted_at: null,
      version: 1,
      owner_id: null,
      search_text: "hello world example",
    });

    expect(created.capture_id).toBe(captureId);

    const fetched = await captures.get(captureId);
    expect(fetched!.content_text).toBe("Hello world");

    const byContext = await captures.listByContext(contextId);
    expect(byContext.length).toBe(1);
  });

  it("tag getOrCreate and link", async () => {
    const tag1 = await tags.getOrCreate("  My Tag  ");
    expect(tag1.name).toBe("my tag");
    expect(tag1.display_name).toBe("My Tag");

    const tag2 = await tags.getOrCreate("my tag");
    expect(tag2.tag_id).toBe(tag1.tag_id);

    const captureId = generateId();
    await tags.linkToCapture(captureId, tag1.tag_id);
    const captureTags = await tags.getTagsForCapture(captureId);
    expect(captureTags.length).toBe(1);
    expect(captureTags[0].name).toBe("my tag");
  });

  it("attachment sha256 dedup", async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "application/octet-stream" });
    const created = await attachments.create({
      attachment_id: generateId(),
      sha256: "abc123",
      mime: "application/octet-stream",
      size: 3,
      width: null,
      height: null,
      blob,
      thumb: null,
    });
    expect(created.sha256).toBe("abc123");

    const found = await attachments.getBySha256("abc123");
    expect(found).not.toBeNull();
    expect(found!.attachment_id).toBe(created.attachment_id);

    const notFound = await attachments.getBySha256("nonexistent");
    expect(notFound).toBeNull();
  });

  it("change journal", async () => {
    await journal.write("contexts", generateId(), "create", ["title"], "device-1");
    await journal.write("captures", generateId(), "update", ["content_text"], "device-1");
    const entries = await journal.list();
    expect(entries.length).toBe(2);
    expect(entries[0].op).toBe("create");
    expect(entries[1].op).toBe("update");
    const lastSeq = await journal.getLastSeq();
    expect(lastSeq).toBeGreaterThanOrEqual(2);
  });
});

describe("Utilities", () => {
  it("normaliseSearchText", () => {
    const result = normaliseSearchText(["Hello World", null, "Example.com"]);
    expect(result).toContain("hello");
    expect(result).toContain("world");
    expect(result).toContain("example");
  });

  it("stripDiacritics", () => {
    expect(stripDiacritics("café")).toBe("cafe");
    expect(stripDiacritics("naïve")).toBe("naive");
  });

  it("extractDomain", () => {
    expect(extractDomain("https://example.com/page")).toBe("example.com");
    expect(extractDomain(null)).toBeNull();
    expect(extractDomain("not-a-url")).toBeNull();
  });

  it("sanitiseFilename", () => {
    expect(sanitiseFilename("my/file:name*")).toBe("my_file_name_");
    expect(sanitiseFilename("normal name")).toBe("normal_name");
  });

  it("generateId produces UUIDs", () => {
    const id = generateId();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
