import { describe, it, expect } from "vitest";
import { similarityEngine } from "../../src/core/search/similarity";
import { captures as capRepo } from "../../src/data/repositories";
import { generateId, nowISO } from "../../src/shared/types";

describe("SimilarityEngine (Phase 3)", () => {
  it("detects exact URL duplicates", async () => {
    const url = "https://react.dev/reference/react";
    const cap1 = {
      capture_id: generateId(),
      type: "link" as const,
      context_id: "ctx1",
      created_at: nowISO(),
      updated_at: nowISO(),
      source_url: url,
      source_title: "React Reference",
      source_domain: "react.dev",
      content_text: "React reference guide for hooks",
      user_note: null,
      tags: ["react"],
    };
    await capRepo.create(cap1);

    const dupes = await similarityEngine.findDuplicates({
      capture_id: "new-id",
      source_url: url,
      content_text: "Something else",
    });

    expect(dupes.length).toBeGreaterThan(0);
    expect(dupes[0].reason).toBe("exact_url");
    expect(dupes[0].score).toBe(1.0);
  });

  it("detects high text similarity duplicates", async () => {
    const text = "Building performant browser extensions using manifest v3 and local indexedDB database layer";
    const cap2 = {
      capture_id: generateId(),
      type: "text" as const,
      context_id: "ctx1",
      created_at: nowISO(),
      updated_at: nowISO(),
      source_url: "https://example.com/blog/1",
      source_title: "Extensions Guide",
      source_domain: "example.com",
      content_text: text,
      user_note: null,
      tags: ["extensions"],
    };
    await capRepo.create(cap2);

    const dupes = await similarityEngine.findDuplicates({
      capture_id: "new-id-2",
      source_url: "https://example.com/different-url",
      content_text: text,
    });

    expect(dupes.length).toBeGreaterThan(0);
    expect(dupes[0].score).toBeGreaterThanOrEqual(0.8);
  });

  it("finds related captures by overlapping terms and domain", async () => {
    const idA = generateId();
    const idB = generateId();

    await capRepo.create({
      capture_id: idA,
      type: "text" as const,
      context_id: "ctx-test",
      created_at: nowISO(),
      updated_at: nowISO(),
      source_url: "https://vitejs.dev/guide",
      source_title: "Vite Guide",
      source_domain: "vitejs.dev",
      content_text: "Vite is a frontend build tool that provides extremely fast bundling",
      user_note: "bundler tools",
      tags: ["vite", "frontend"],
    });

    await capRepo.create({
      capture_id: idB,
      type: "text" as const,
      context_id: "ctx-test",
      created_at: nowISO(),
      updated_at: nowISO(),
      source_url: "https://vitejs.dev/config",
      source_title: "Vite Config",
      source_domain: "vitejs.dev",
      content_text: "Configure fast bundling and plugins with Vite build tool",
      user_note: "bundler config",
      tags: ["vite", "config"],
    });

    const related = await similarityEngine.findRelated(idA);
    expect(related.length).toBeGreaterThan(0);
    expect(related.some((r) => r.capture.capture_id === idB)).toBe(true);
    const match = related.find((r) => r.capture.capture_id === idB);
    expect(match?.score).toBeGreaterThan(0.2);
    expect(match?.commonTerms).toContain("bundling");
  });
});
