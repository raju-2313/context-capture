import { captures as capRepo, contexts as ctxRepo, tags as tagRepo } from "../../data/repositories";
import { Capture, ContextRecord, TagRecord } from "../../shared/types";
import { nowISO } from "../../shared/types";
import { logger } from "../../shared/logger";

export class ExportEngine {
  async exportMarkdownCaptures(captureIds: string[]): Promise<Blob> {
    const parts: string[] = [];
    for (const id of captureIds) {
      const cap = await capRepo.get(id);
      if (!cap) continue;
      parts.push(this.captureToMarkdown(cap));
    }
    const md = parts.join("\n\n---\n\n");
    return new Blob([md], { type: "text/markdown;charset=utf-8" });
  }

  async exportMarkdownContext(contextId: string): Promise<Blob> {
    const ctx = await ctxRepo.get(contextId);
    const caps = await capRepo.listByContext(contextId);
    const lines: string[] = [];
    lines.push(`# ${ctx?.title || "Context"}`);
    lines.push(`Source: ${ctx?.last_url || "N/A"}`);
    lines.push(`Captured: ${ctx?.created_at || "N/A"}`);
    lines.push("");
    for (const cap of caps) {
      lines.push(this.captureToMarkdown(cap));
    }
    return new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
  }

  async exportBackup(): Promise<Blob> {
    const contexts = await ctxRepo.list({ includeDeleted: true });
    const allCaptures: Capture[] = [];
    for (const ctx of contexts) {
      const caps = await capRepo.listByContext(ctx.context_id);
      allCaptures.push(...caps);
    }
    const allTags = await tagRepo.list();

    const manifest = {
      schema_version: 1,
      app_version: "1.0.0",
      exported_at: nowISO(),
      counts: {
        contexts: contexts.length,
        captures: allCaptures.length,
        tags: allTags.length,
        attachments: 0,
      },
    };

    const data = JSON.stringify({
      contexts,
      captures: allCaptures,
      tags: allTags,
    }, null, 2);

    // Create a simple ZIP-like structure as a single JSON file for MVP
    // Full ZIP with jszip can be added in a later step
    const backup = {
      manifest,
      data,
    };

    return new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" });
  }

  private captureToMarkdown(cap: Capture): string {
    const lines: string[] = [];
    lines.push(`## ${cap.type.toUpperCase()}: ${cap.source_title || cap.content_text?.slice(0, 80) || "Untitled"}`);
    if (cap.source_url) lines.push(`- Source: [${cap.source_title || cap.source_url}](${cap.source_url})`);
    lines.push(`- Captured: ${cap.created_at}`);
    lines.push(`- Context: ${cap.context_id}`);
    if (cap.user_note) lines.push(`- Note: ${cap.user_note}`);
    if (cap.content_text) lines.push(`\n${cap.content_text}`);
    return lines.join("\n");
  }
}

export const exportEngine = new ExportEngine();