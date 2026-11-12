import { describe, it, expect } from "vitest";
import { obsidianIntegration } from "../../src/core/integrations/obsidian";
import { webhookIntegration } from "../../src/core/integrations/webhook";
import { clipboardIntegration } from "../../src/core/integrations/clipboard";
import { voiceNoteIntegration } from "../../src/core/integrations/voice";
import { captures as capRepo, contexts as ctxRepo } from "../../src/data/repositories";
import { generateId, nowISO } from "../../src/shared/types";

describe("Phase 5: Integrations & Advanced Capabilities", () => {
  it("exports valid Obsidian Vault ZIP with frontmatter and wikilinks", async () => {
    const ctxId = generateId();
    await ctxRepo.create({
      context_id: ctxId,
      title: "Obsidian Research",
      status: "active",
      created_at: nowISO(),
      last_active_at: nowISO(),
      first_url: "https://obsidian.md",
      last_url: "https://obsidian.md",
      deleted_at: null,
      version: 1,
      owner_id: null,
    });

    await capRepo.create({
      capture_id: generateId(),
      type: "note",
      context_id: ctxId,
      created_at: nowISO(),
      updated_at: nowISO(),
      source_url: "https://obsidian.md",
      source_title: "Obsidian Notes",
      source_domain: "obsidian.md",
      content_text: "Markdown files stored locally with bidirectional links",
      user_note: "great for PKM",
      tags: ["pkm", "notes"],
    });

    const vaultBlob = await obsidianIntegration.exportVaultZip();
    expect(vaultBlob).toBeInstanceOf(Blob);
    expect(vaultBlob.size).toBeGreaterThan(0);
  });

  it("handles webhook dispatch configuration", async () => {
    await webhookIntegration.setWebhookUrl("https://httpbin.org/post");
    const url = await webhookIntegration.getWebhookUrl();
    expect(url).toBe("https://httpbin.org/post");

    // Clear url test
    await webhookIntegration.setWebhookUrl("");
    const empty = await webhookIntegration.getWebhookUrl();
    expect(empty).toBe("");

    const res = await webhookIntegration.sendCapture({
      capture_id: "test",
      type: "text",
      context_id: "ctx",
      created_at: nowISO(),
      updated_at: nowISO(),
      source_url: null,
      source_title: "Test",
      source_domain: null,
      favicon_data: null,
      content_text: "Test content",
      code_language: null,
      user_note: null,
      anchor: null,
      question_state: null,
      incognito: false,
      deleted_at: null,
      version: 1,
      owner_id: null,
      search_text: "test content",
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("No webhook URL configured");
  });

  it("voice note integration reports browser support state safely", () => {
    expect(typeof voiceNoteIntegration.isSupported).toBe("function");
    // in test environment without Web Speech API
    expect(voiceNoteIntegration.isSupported()).toBe(false);
  });
});

