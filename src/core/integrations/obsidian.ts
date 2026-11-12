import JSZip from "jszip";
import { captures as capRepo, contexts as ctxRepo, projects as projRepo } from "../../data/repositories";
import { sanitiseFilename, nowISO } from "../../shared/types";

export class ObsidianIntegration {
  /**
   * Generates a complete, ready-to-use Obsidian Vault ZIP archive
   * with YAML frontmatter, wikilinks, and organized folders.
   */
  async exportVaultZip(): Promise<Blob> {
    const zip = new JSZip();

    const [contexts, captures, projects] = await Promise.all([
      ctxRepo.list({ includeDeleted: false }),
      capRepo.listAll({ limit: 100000 }),
      projRepo.list({ includeDeleted: false }),
    ]);

    const activeCaptures = captures.filter((c) => !c.deleted_at);

    // Context map for wikilinks
    const contextMap = new Map<string, string>();
    for (const ctx of contexts) {
      contextMap.set(ctx.context_id, ctx.title);
    }

    // 1. Vault Readme / Home note
    const homeNote = [
      "---",
      "tags: [contextcapture, vault-home]",
      `exported: ${nowISO()}`,
      "---",
      "# ContextCapture Knowledge Vault",
      "",
      `Welcome to your exported knowledge vault containing **${activeCaptures.length} captures** across **${contexts.length} contexts** and **${projects.length} projects**.`,
      "",
      "## 📂 Projects",
      ...projects.map((p) => `- [[Projects/${sanitiseFilename(p.title)}|${p.title}]]`),
      "",
      "## 🌐 Browser Contexts",
      ...contexts.map((c) => `- [[Contexts/${sanitiseFilename(c.title)}|${c.title}]]`),
    ].join("\n");

    zip.file("Home.md", homeNote);

    // 2. Contexts folder
    const contextsFolder = zip.folder("Contexts");
    for (const ctx of contexts) {
      const ctxCaps = activeCaptures.filter((c) => c.context_id === ctx.context_id);
      const ctxContent = [
        "---",
        `title: "${ctx.title.replace(/"/g, '\\"')}"`,
        "type: browser-context",
        `source_url: "${ctx.last_url || ""}"`,
        `created: ${ctx.created_at}`,
        "tags: [browser-context]",
        "---",
        `# ${ctx.title}`,
        ctx.last_url ? `**URL**: [${ctx.last_url}](${ctx.last_url})\n` : "",
        "## Captures in this Context",
        ...ctxCaps.map((c) => {
          const capTitle = c.source_title || c.content_text?.slice(0, 40) || c.capture_id;
          return `- [[Captures/${sanitiseFilename(capTitle)}|${capTitle}]] (${c.type})`;
        }),
      ].join("\n");

      contextsFolder?.file(`${sanitiseFilename(ctx.title)}.md`, ctxContent);
    }

    // 3. Captures folder
    const capturesFolder = zip.folder("Captures");
    for (const cap of activeCaptures) {
      const capTitle = cap.source_title || cap.content_text?.slice(0, 40) || `Capture-${cap.capture_id.slice(0, 8)}`;
      const safeFilename = sanitiseFilename(capTitle) || cap.capture_id;

      const tagsYaml = (cap.tags || ["capture"]).map((t: string) => (t.startsWith("#") ? t.slice(1) : t)).join(", ");
      const contextTitle = contextMap.get(cap.context_id) || "Unfiled";

      const capContent = [
        "---",
        `id: "${cap.capture_id}"`,
        `type: "${cap.type}"`,
        `created: ${cap.created_at}`,
        `url: "${cap.source_url || ""}"`,
        `domain: "${cap.source_domain || ""}"`,
        `context: "[[Contexts/${sanitiseFilename(contextTitle)}|${contextTitle}]]"`,
        `tags: [${tagsYaml}]`,
        "---",
        `# ${cap.source_title || capTitle}`,
        "",
        cap.source_url ? `> **Source**: [${cap.source_title || cap.source_url}](${cap.source_url})\n` : "",
        `> **Context**: [[Contexts/${sanitiseFilename(contextTitle)}|${contextTitle}]]`,
        "",
        cap.code_language ? `\`\`\`${cap.code_language}\n${cap.content_text || ""}\n\`\`\`` : cap.content_text || "",
        "",
        cap.user_note ? `### Personal Note\n${cap.user_note}\n` : "",
      ].join("\n");

      capturesFolder?.file(`${safeFilename}.md`, capContent);
    }

    // 4. Projects folder
    const projectsFolder = zip.folder("Projects");
    for (const prj of projects) {
      const prjCaps = await projRepo.listCaptures(prj.project_id);
      const prjContent = [
        "---",
        `title: "${prj.title.replace(/"/g, '\\"')}"`,
        "type: project",
        `created: ${prj.created_at}`,
        "tags: [project]",
        "---",
        `# ${prj.title}`,
        prj.description ? `\n${prj.description}\n` : "",
        "## Curated Captures",
        ...prjCaps.map((c) => {
          const capTitle = c.source_title || c.content_text?.slice(0, 40) || c.capture_id;
          return `- [[Captures/${sanitiseFilename(capTitle)}|${capTitle}]]`;
        }),
      ].join("\n");

      projectsFolder?.file(`${sanitiseFilename(prj.title)}.md`, prjContent);
    }

    return await zip.generateAsync({ type: "blob" });
  }
}

export const obsidianIntegration = new ObsidianIntegration();
