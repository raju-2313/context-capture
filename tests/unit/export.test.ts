import { describe, it, expect } from "vitest";
import { exportEngine } from "../../src/core/export/index";

async function blobToText(blob: Blob): Promise<string> {
  if (typeof blob.text === "function") {
    return blob.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(blob);
  });
}

describe("Export engine", () => {
  it("exportEngine exists with all export methods", () => {
    expect(exportEngine).toBeDefined();
    expect(typeof exportEngine.exportMarkdownCaptures).toBe("function");
    expect(typeof exportEngine.exportMarkdownContext).toBe("function");
    expect(typeof exportEngine.exportBackup).toBe("function");
    expect(typeof exportEngine.exportBackupZip).toBe("function");
    expect(typeof exportEngine.exportPdf).toBe("function");
  });

  it("exports empty markdown captures", async () => {
    const blob = await exportEngine.exportMarkdownCaptures([]);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toContain("text/markdown");
    const text = await blobToText(blob);
    expect(text).toBe("");
  });

  it("exports valid JSON backup with manifest", async () => {
    const blob = await exportEngine.exportBackup();
    expect(blob).toBeInstanceOf(Blob);
    const text = await blobToText(blob);
    const parsed = JSON.parse(text);
    expect(parsed.manifest).toBeDefined();
    expect(parsed.manifest.schema_version).toBe(3);
    expect(parsed.data).toBeDefined();
  });

  it("exports valid ZIP archive", async () => {
    const blob = await exportEngine.exportBackupZip();
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it("generates a PDF blob for capture list", async () => {
    const blob = await exportEngine.exportPdf([]);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });
});
