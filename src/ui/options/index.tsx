import { useState, useEffect } from "preact/hooks";
import { render } from "preact/compat";
import { settingsStore } from "../../data/settings";
import { captures as capRepo, contexts as ctxRepo, attachments as attRepo } from "../../data/repositories";
import { exportEngine } from "../../core/export";

type ImportStatus = { phase: "idle" | "running" | "done" | "error"; message: string };

export default function Settings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [storageInfo, setStorageInfo] = useState({ captures: 0, contexts: 0, attachments: 0, usedMB: "0.0" });
  const [importStatus, setImportStatus] = useState<ImportStatus>({ phase: "idle", message: "" });
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const all = await settingsStore.getAll();
    setSettings(all);

    const [caps, ctxs, atts] = await Promise.all([
      capRepo.count(),
      ctxRepo.count(),
      attRepo.count(),
    ]);

    let usedMB = "0.0";
    try {
      const est = await navigator.storage.estimate();
      usedMB = ((est.usage || 0) / 1024 / 1024).toFixed(1);
    } catch {}

    setStorageInfo({ captures: caps, contexts: ctxs, attachments: atts, usedMB });
  }

  async function saveSetting(key: string, value: string) {
    await settingsStore.set(key, value);
    setSettings({ ...settings, [key]: value });
    // Apply theme immediately
    if (key === "theme") {
      if (value === "dark") document.documentElement.setAttribute("data-theme", "dark");
      else document.documentElement.removeAttribute("data-theme");
    }
  }

  async function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleExportJSON() {
    setExporting("json");
    try {
      const blob = await exportEngine.exportBackup();
      await downloadBlob(blob, `contextcapture-backup-${new Date().toISOString().slice(0, 10)}.json`);
    } finally {
      setExporting(null);
    }
  }

  async function handleExportMarkdown() {
    setExporting("md");
    try {
      const all = await capRepo.listAll({ limit: 100000 });
      const ids = all.map((c: any) => c.capture_id);
      const blob = await exportEngine.exportMarkdownCaptures(ids);
      await downloadBlob(blob, `contextcapture-all-${new Date().toISOString().slice(0, 10)}.md`);
    } finally {
      setExporting(null);
    }
  }

  async function handleExportMarkdownByContext() {
    setExporting("md-ctx");
    try {
      const ctxs = await ctxRepo.list({ includeDeleted: false });
      const parts: string[] = [];
      for (const ctx of ctxs) {
        const blob = await exportEngine.exportMarkdownContext(ctx.context_id);
        parts.push(await blob.text());
      }
      const combined = new Blob([parts.join("\n\n---\n\n")], { type: "text/markdown;charset=utf-8" });
      await downloadBlob(combined, `contextcapture-contexts-${new Date().toISOString().slice(0, 10)}.md`);
    } finally {
      setExporting(null);
    }
  }

  async function handleImportBackup() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setImportStatus({ phase: "running", message: "Parsing backup file..." });
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);

        // Support two formats: new {manifest, data} or legacy flat {contexts, captures, tags}
        let data: any;
        if (parsed.manifest && parsed.data) {
          data = typeof parsed.data === "string" ? JSON.parse(parsed.data) : parsed.data;
          const v = parsed.manifest?.schema_version;
          if (v && v > 2) {
            setImportStatus({ phase: "error", message: `Unsupported schema version: ${v}` });
            return;
          }
        } else if (parsed.contexts && parsed.captures) {
          data = parsed;
        } else {
          setImportStatus({ phase: "error", message: "Invalid backup format. Missing contexts/captures." });
          return;
        }

        const contexts: any[] = data.contexts || [];
        const captures: any[] = data.captures || [];

        let importedCtx = 0;
        let skippedCtx = 0;
        let importedCap = 0;
        let skippedCap = 0;

        setImportStatus({ phase: "running", message: `Importing ${contexts.length} contexts...` });
        for (const ctx of contexts) {
          const existing = await ctxRepo.get(ctx.context_id);
          if (existing) { skippedCtx++; continue; }
          await ctxRepo.create(ctx);
          importedCtx++;
        }

        setImportStatus({ phase: "running", message: `Importing ${captures.length} captures...` });
        for (const cap of captures) {
          const existing = await capRepo.get(cap.capture_id);
          if (existing) { skippedCap++; continue; }
          await capRepo.create(cap);
          importedCap++;
        }

        await load();
        setImportStatus({
          phase: "done",
          message: `✅ Imported ${importedCtx} contexts, ${importedCap} captures. Skipped ${skippedCtx + skippedCap} duplicates.`,
        });
      } catch (err: any) {
        setImportStatus({ phase: "error", message: `Import failed: ${err?.message || String(err)}` });
      }
    };
    input.click();
  }

  return (
    <div class="container">
      <div class="header">
        <div class="app-title">Settings</div>
      </div>
      <div class="content">

        {/* Storage */}
        <div class="settings-section">
          <h4>Storage</h4>
          <div class="setting-row">
            <span>Captures</span>
            <span>{storageInfo.captures}</span>
          </div>
          <div class="setting-row">
            <span>Contexts</span>
            <span>{storageInfo.contexts}</span>
          </div>
          <div class="setting-row">
            <span>Attachments</span>
            <span>{storageInfo.attachments}</span>
          </div>
          <div class="setting-row">
            <span>Estimated storage used</span>
            <span style={{ fontWeight: 600, color: "var(--accent)" }}>{storageInfo.usedMB} MB</span>
          </div>
        </div>

        {/* Appearance */}
        <div class="settings-section">
          <h4>Appearance</h4>
          <div class="setting-row">
            <span>Theme</span>
            <select
              class="filter-select"
              value={settings["theme"] || "auto"}
              onChange={(e) => saveSetting("theme", e.currentTarget.value)}
              style={{ width: "auto", minWidth: 80 }}
            >
              <option value="auto">Auto</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </div>

        {/* Privacy */}
        <div class="settings-section">
          <h4>Privacy</h4>
          <div class="setting-row">
            <span>Incognito capture</span>
            <label class="toggle">
              <input
                type="checkbox"
                checked={settings["incognito_enabled"] === "true"}
                onChange={(e) => saveSetting("incognito_enabled", e.currentTarget.checked ? "true" : "false")}
              />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="setting-row">
            <span>Strip query strings from URLs</span>
            <label class="toggle">
              <input
                type="checkbox"
                checked={settings["strip_query_strings"] === "true"}
                onChange={(e) => saveSetting("strip_query_strings", e.currentTarget.checked ? "true" : "false")}
              />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="setting-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
            <span>Domain blocklist</span>
            <input
              class="input"
              value={settings["domain_blocklist"] || ""}
              onBlur={(e) => saveSetting("domain_blocklist", e.currentTarget.value)}
              placeholder="e.g. bank.com, paypal.com"
              style={{ width: "100%" }}
            />
            <div style={{ fontSize: 11, color: "#86868b" }}>
              Comma-separated domains. Captures from these domains will be warned.
            </div>
          </div>
        </div>

        {/* Export & Backup */}
        <div class="settings-section">
          <h4>Export &amp; Backup</h4>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              class="btn btn-primary"
              style={{ width: "100%" }}
              onClick={async () => {
                setExporting("zip");
                try {
                  const blob = await exportEngine.exportBackupZip();
                  await downloadBlob(blob, `contextcapture-full-backup-${new Date().toISOString().slice(0, 10)}.zip`);
                } finally {
                  setExporting(null);
                }
              }}
              disabled={exporting === "zip"}
            >
              {exporting === "zip" ? "Exporting ZIP..." : "🗜️ Export Complete ZIP Backup (with Attachments)"}
            </button>

            <button
              class="btn"
              style={{ width: "100%" }}
              onClick={handleExportJSON}
              disabled={exporting === "json"}
            >
              {exporting === "json" ? "Exporting..." : "📦 Export JSON Backup"}
            </button>

            <button
              class="btn"
              style={{ width: "100%" }}
              onClick={async () => {
                setExporting("pdf");
                try {
                  const all = await capRepo.listAll({ limit: 10000 });
                  const ids = all.map((c: any) => c.capture_id);
                  const blob = await exportEngine.exportPdf(ids);
                  await downloadBlob(blob, `contextcapture-${new Date().toISOString().slice(0, 10)}.pdf`);
                } finally {
                  setExporting(null);
                }
              }}
              disabled={exporting === "pdf"}
            >
              {exporting === "pdf" ? "Generating PDF..." : "📄 Export All as PDF"}
            </button>

            <button
              class="btn"
              style={{ width: "100%" }}
              onClick={handleExportMarkdown}
              disabled={exporting === "md"}
            >
              {exporting === "md" ? "Exporting..." : "📝 Export All as Markdown"}
            </button>

            <button
              class="btn"
              style={{ width: "100%" }}
              onClick={handleExportMarkdownByContext}
              disabled={exporting === "md-ctx"}
            >
              {exporting === "md-ctx" ? "Exporting..." : "📂 Export All Contexts as Markdown"}
            </button>
          </div>
        </div>

        {/* Import */}
        <div class="settings-section">
          <h4>Import</h4>
          <button
            class="btn"
            style={{ width: "100%" }}
            onClick={handleImportBackup}
            disabled={importStatus.phase === "running"}
          >
            {importStatus.phase === "running" ? "Importing..." : "📥 Import Backup (JSON)"}
          </button>
          {importStatus.message && (
            <div
              style={{
                marginTop: 8,
                padding: "8px 12px",
                borderRadius: 6,
                fontSize: 12,
                background: importStatus.phase === "error" ? "#ff3b3020" : importStatus.phase === "done" ? "#34c75920" : "var(--muted)",
                color: importStatus.phase === "error" ? "var(--danger)" : importStatus.phase === "done" ? "var(--success)" : "var(--text)",
                border: `1px solid ${importStatus.phase === "error" ? "var(--danger)" : importStatus.phase === "done" ? "var(--success)" : "var(--border)"}`,
              }}
            >
              {importStatus.message}
            </div>
          )}
        </div>

        {/* About */}
        <div class="settings-section">
          <h4>About</h4>
          <div class="setting-row">
            <span>Version</span>
            <span>1.0.0</span>
          </div>
          <div class="setting-row">
            <span>Data location</span>
            <span>Local device only (IndexedDB)</span>
          </div>
          <div class="setting-row">
            <button
              class="btn"
              style={{ width: "100%" }}
              onClick={() => {
                const diag = JSON.stringify({
                  version: "1.0.0",
                  storage: storageInfo,
                  settings,
                  userAgent: navigator.userAgent,
                  timestamp: new Date().toISOString(),
                }, null, 2);
                navigator.clipboard.writeText(diag);
                alert("Diagnostics copied to clipboard!");
              }}
            >
              Copy Diagnostics
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

render(<Settings />, document.getElementById("root")!);
