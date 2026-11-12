import JSZip from "jszip";
import { jsPDF } from "jspdf";
import {
  captures as capRepo,
  contexts as ctxRepo,
  tags as tagRepo,
  projects as projRepo,
  attachments as attRepo,
} from "../../data/repositories";
import { Capture, ContextRecord, TagRecord } from "../../shared/types";
import { nowISO } from "../../shared/types";
import { logger } from "../../shared/logger";

export class ExportEngine {
  /** Export selected captures as a formatted Markdown blob */
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

  /** Export all captures in a context as a formatted Markdown blob */
  async exportMarkdownContext(contextId: string): Promise<Blob> {
    const ctx = await ctxRepo.get(contextId);
    const caps = await capRepo.listByContext(contextId);
    const lines: string[] = [];
    lines.push(`# ${ctx?.title || "Context"}`);
    if (ctx?.last_url) lines.push(`Source: ${ctx.last_url}`);
    lines.push(`Captured: ${ctx?.created_at || "N/A"}`);
    lines.push(`Total captures: ${caps.length}`);
    lines.push("");
    for (const cap of caps) {
      lines.push(this.captureToMarkdown(cap));
    }
    return new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
  }

  /** Export complete library backup as JSON */
  async exportBackup(): Promise<Blob> {
    const [contexts, allCaptures, allTags, allProjects] = await Promise.all([
      ctxRepo.list({ includeDeleted: true }),
      capRepo.listAll({ limit: 100000 }),
      tagRepo.list(),
      projRepo.list({ includeDeleted: true }),
    ]);

    const manifest = {
      schema_version: 3,
      app_version: "1.0.0",
      exported_at: nowISO(),
      counts: {
        contexts: contexts.length,
        captures: allCaptures.length,
        tags: allTags.length,
        projects: allProjects.length,
      },
    };

    const backup = {
      manifest,
      data: {
        contexts,
        captures: allCaptures,
        tags: allTags,
        projects: allProjects,
      },
    };

    return new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json;charset=utf-8",
    });
  }

  /**
   * Export complete library as a genuine ZIP archive with:
   * - manifest.json
   * - contexts.json
   * - captures.json
   * - tags.json
   * - projects.json
   * - attachments/ folder with actual binary files
   */
  async exportBackupZip(): Promise<Blob> {
    const zip = new JSZip();

    const [contexts, allCaptures, allTags, allProjects] = await Promise.all([
      ctxRepo.list({ includeDeleted: true }),
      capRepo.listAll({ limit: 100000 }),
      tagRepo.list(),
      projRepo.list({ includeDeleted: true }),
    ]);

    const manifest = {
      schema_version: 3,
      app_version: "1.0.0",
      exported_at: nowISO(),
      counts: {
        contexts: contexts.length,
        captures: allCaptures.length,
        tags: allTags.length,
        projects: allProjects.length,
      },
    };

    zip.file("manifest.json", JSON.stringify(manifest, null, 2));
    zip.file("contexts.json", JSON.stringify(contexts, null, 2));
    zip.file("captures.json", JSON.stringify(allCaptures, null, 2));
    zip.file("tags.json", JSON.stringify(allTags, null, 2));
    zip.file("projects.json", JSON.stringify(allProjects, null, 2));

    // Include binary attachments
    const attachmentsFolder = zip.folder("attachments");
    if (attachmentsFolder) {
      for (const cap of allCaptures) {
        if (cap.attachment_ids && cap.attachment_ids.length > 0) {
          for (const attId of cap.attachment_ids) {
            try {
              const att = await attRepo.get(attId);
              if (att && att.data_blob) {
                const ext = att.mime_type?.includes("png") ? "png" : "jpg";
                attachmentsFolder.file(`${attId}.${ext}`, att.data_blob);
              }
            } catch (e) {
              logger.warn(`Could not add attachment ${attId} to zip`, String(e));
            }
          }
        }
      }
    }

    return await zip.generateAsync({ type: "blob" });
  }

  /**
   * Export captures to a beautifully formatted PDF using jsPDF
   */
  async exportPdf(captureIds: string[]): Promise<Blob> {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    // Header / Cover band
    doc.setFillColor(0, 113, 227); // #0071e3 accent
    doc.rect(0, 0, pageWidth, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("ContextCapture Export", margin, 18);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Exported: ${new Date().toLocaleDateString()} • ${captureIds.length} captures`,
      margin,
      24
    );

    y = 38;
    doc.setTextColor(29, 29, 31);

    for (let i = 0; i < captureIds.length; i++) {
      const cap = await capRepo.get(captureIds[i]);
      if (!cap) continue;

      // Check remaining space on page (need at least 40mm)
      if (y > 250) {
        doc.addPage();
        y = margin;
      }

      // Capture card container line
      doc.setDrawColor(229, 229, 231);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;

      // Type badge & date
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 113, 227);
      doc.text(cap.type.toUpperCase(), margin, y);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(134, 134, 139);
      const dateStr = new Date(cap.created_at).toLocaleDateString();
      const domainStr = cap.source_domain ? ` • ${cap.source_domain}` : "";
      doc.text(dateStr + domainStr, margin + 25, y);
      y += 6;

      // Title
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(29, 29, 31);
      const title = cap.source_title || cap.source_url || "Untitled Capture";
      const titleLines = doc.splitTextToSize(title, contentWidth);
      doc.text(titleLines, margin, y);
      y += titleLines.length * 6;

      // Source URL if present
      if (cap.source_url) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 113, 227);
        const urlLines = doc.splitTextToSize(cap.source_url, contentWidth);
        doc.text(urlLines, margin, y);
        y += urlLines.length * 4.5;
      }

      // Content text if present
      if (cap.content_text) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(50, 50, 50);
        const textSample = cap.content_text.slice(0, 1000);
        const textLines = doc.splitTextToSize(textSample, contentWidth);
        doc.text(textLines, margin, y);
        y += textLines.length * 5;
      }

      // User note if present
      if (cap.user_note) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(100, 100, 100);
        const noteLines = doc.splitTextToSize(`Note: ${cap.user_note}`, contentWidth);
        doc.text(noteLines, margin, y);
        y += noteLines.length * 4.5;
      }

      y += 6; // spacing before next item
    }

    return doc.output("blob");
  }

  private captureToMarkdown(cap: Capture): string {
    const lines: string[] = [];
    lines.push(
      `## ${cap.type.toUpperCase()}: ${cap.source_title || cap.content_text?.slice(0, 80) || "Untitled"}`
    );
    if (cap.source_url)
      lines.push(`- Source: [${cap.source_title || cap.source_url}](${cap.source_url})`);
    lines.push(`- Captured: ${cap.created_at}`);
    lines.push(`- Context: ${cap.context_id}`);
    if (cap.user_note) lines.push(`- Note: ${cap.user_note}`);
    if (cap.tags && cap.tags.length > 0)
      lines.push(`- Tags: ${cap.tags.map((t) => `#${t}`).join(" ")}`);
    if (cap.content_text) lines.push(`\n${cap.content_text}`);
    return lines.join("\n");
  }
}

export const exportEngine = new ExportEngine();
