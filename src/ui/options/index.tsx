import { useState, useEffect } from "preact/hooks";
import { render } from "preact/compat";
import { settingsStore } from "../../data/settings";
import { captures as capRepo, contexts as ctxRepo, attachments as attRepo } from "../../data/repositories";
import { exportEngine } from "../../core/export";
import { obsidianIntegration } from "../../core/integrations/obsidian";
import { webhookIntegration } from "../../core/integrations/webhook";
import {
  ZipIcon,
  ExportIcon,
  PdfIcon,
  MarkdownIcon,
  FolderIcon,
  ObsidianIcon,
  ImportIcon,
  SparklesIcon,
  ShieldIcon,
  DatabaseIcon,
  UploadCloudIcon,
  CopyIcon,
  CheckIcon,
  NoteIcon,
  ScreenshotIcon,
} from "../components/Icons";

type ImportStatus = { phase: "idle" | "running" | "done" | "error"; message: string };
type TabId = "overview" | "export" | "privacy" | "integrations";

export default function Settings() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [storageInfo, setStorageInfo] = useState({ captures: 0, contexts: 0, attachments: 0, usedMB: "0.0" });
  const [importStatus, setImportStatus] = useState<ImportStatus>({ phase: "idle", message: "" });
  const [exporting, setExporting] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [webhookTestStatus, setWebhookTestStatus] = useState<string | null>(null);

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
    setSettings((prev) => ({ ...prev, [key]: value }));
    if (key === "theme") {
      if (value === "dark") document.documentElement.setAttribute("data-theme", "dark");
      else if (value === "light") document.documentElement.removeAttribute("data-theme");
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

  async function handleExportZip() {
    setExporting("zip");
    try {
      const blob = await exportEngine.exportBackupZip();
      await downloadBlob(blob, `ContextCapture-Archive-${new Date().toISOString().slice(0, 10)}.zip`);
    } finally {
      setExporting(null);
    }
  }

  async function handleExportObsidian() {
    setExporting("obsidian");
    try {
      const blob = await obsidianIntegration.exportVaultZip();
      await downloadBlob(blob, `ContextCapture-Obsidian-${new Date().toISOString().slice(0, 10)}.zip`);
    } finally {
      setExporting(null);
    }
  }

  async function handleExportJSON() {
    setExporting("json");
    try {
      const blob = await exportEngine.exportBackup();
      await downloadBlob(blob, `ContextCapture-Backup-${new Date().toISOString().slice(0, 10)}.json`);
    } finally {
      setExporting(null);
    }
  }

  async function handleExportPdf() {
    setExporting("pdf");
    try {
      const all = await capRepo.listAll({ limit: 10000 });
      const ids = all.map((c: any) => c.capture_id);
      const blob = await exportEngine.exportPdf(ids);
      await downloadBlob(blob, `ContextCapture-Digest-${new Date().toISOString().slice(0, 10)}.pdf`);
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
      await downloadBlob(blob, `ContextCapture-All-${new Date().toISOString().slice(0, 10)}.md`);
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
      await downloadBlob(combined, `ContextCapture-Contexts-${new Date().toISOString().slice(0, 10)}.md`);
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
      setImportStatus({ phase: "running", message: "Verifying and parsing backup file..." });
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);

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
          setImportStatus({ phase: "error", message: "Invalid backup format. File must contain contexts and captures." });
          return;
        }

        const contexts: any[] = data.contexts || [];
        const captures: any[] = data.captures || [];

        let importedCtx = 0;
        let skippedCtx = 0;
        let importedCap = 0;
        let skippedCap = 0;

        setImportStatus({ phase: "running", message: `Merging ${contexts.length} contexts...` });
        for (const ctx of contexts) {
          const existing = await ctxRepo.get(ctx.context_id);
          if (existing) { skippedCtx++; continue; }
          await ctxRepo.create(ctx);
          importedCtx++;
        }

        setImportStatus({ phase: "running", message: `Merging ${captures.length} captures...` });
        for (const cap of captures) {
          const existing = await capRepo.get(cap.capture_id);
          if (existing) { skippedCap++; continue; }
          await capRepo.create(cap);
          importedCap++;
        }

        await load();
        setImportStatus({
          phase: "done",
          message: `Successfully restored ${importedCtx} contexts and ${importedCap} captures (${skippedCtx + skippedCap} duplicate items preserved).`,
        });
      } catch (err: any) {
        setImportStatus({ phase: "error", message: `Import failed: ${err?.message || String(err)}` });
      }
    };
    input.click();
  }

  function addBlocklistDomain(domain: string) {
    const current = settings["domain_blocklist"] || "";
    const list = current.split(",").map((s) => s.trim()).filter(Boolean);
    if (!list.includes(domain)) {
      list.push(domain);
      saveSetting("domain_blocklist", list.join(", "));
    }
  }

  async function handleCopyDiagnostics() {
    const diag = JSON.stringify(
      {
        product: "ContextCapture",
        version: "1.0.0",
        storage: storageInfo,
        settings,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      },
      null,
      2
    );
    await navigator.clipboard.writeText(diag);
    setCopyFeedback("Diagnostics copied to clipboard!");
    setTimeout(() => setCopyFeedback(null), 2500);
  }

  async function handleTestWebhook() {
    const url = settings["webhook_url"];
    if (!url) {
      setWebhookTestStatus("Please enter a webhook URL first.");
      setTimeout(() => setWebhookTestStatus(null), 3000);
      return;
    }
    setWebhookTestStatus("Sending ping...");
    try {
      const res = await webhookIntegration.sendCapture({
        capture_id: "test-ping",
        type: "note",
        content_text: "Ping from ContextCapture settings",
        source_title: "Webhook Test",
        source_url: "https://contextcapture.local",
        created_at: new Date().toISOString(),
      } as any);
      if (res.success) {
        setWebhookTestStatus("✓ Ping succeeded (HTTP 200)");
      } else {
        setWebhookTestStatus(`Failed: ${res.error || "HTTP error"}`);
      }
    } catch (e: any) {
      setWebhookTestStatus(`Error: ${e.message || "Failed to reach endpoint"}`);
    }
    setTimeout(() => setWebhookTestStatus(null), 4000);
  }

  return (
    <div class="settings-page">
      <div class="settings-container">
        {/* Header Hero */}
        <div class="settings-header-hero">
          <div class="settings-header-top">
            <h1 class="settings-main-title">Workspace Settings</h1>
            <div class="settings-badges">
              <span class="settings-badge highlight">v1.0.0</span>
              <span class="settings-badge">Local-First</span>
              <span class="settings-badge">IndexedDB</span>
            </div>
          </div>
          <p class="settings-subtitle">
            Manage your offline storage, configure privacy safeguards, and export your research library.
          </p>

          {/* Navigation Bar */}
          <nav class="settings-nav" role="tablist">
            <button
              class={`settings-nav-btn ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => setActiveTab("overview")}
              role="tab"
              aria-selected={activeTab === "overview"}
            >
              <DatabaseIcon size={14} /> Overview &amp; Storage
            </button>
            <button
              class={`settings-nav-btn ${activeTab === "export" ? "active" : ""}`}
              onClick={() => setActiveTab("export")}
              role="tab"
              aria-selected={activeTab === "export"}
            >
              <ZipIcon size={14} /> Exports &amp; Backups
            </button>
            <button
              class={`settings-nav-btn ${activeTab === "privacy" ? "active" : ""}`}
              onClick={() => setActiveTab("privacy")}
              role="tab"
              aria-selected={activeTab === "privacy"}
            >
              <ShieldIcon size={14} /> Privacy &amp; Safety
            </button>
            <button
              class={`settings-nav-btn ${activeTab === "integrations" ? "active" : ""}`}
              onClick={() => setActiveTab("integrations")}
              role="tab"
              aria-selected={activeTab === "integrations"}
            >
              <SparklesIcon size={14} /> Integrations &amp; AI
            </button>
          </nav>
        </div>

        {/* Tab 1: Overview & Storage */}
        {activeTab === "overview" && (
          <div>
            <div class="settings-card">
              <div class="settings-card-header">
                <div class="settings-card-title-group">
                  <h3 class="settings-card-title">
                    <DatabaseIcon size={16} color="var(--lime)" /> Local Storage Health
                  </h3>
                  <span class="settings-card-subtitle">
                    IndexedDB items stored entirely inside your browser on this machine
                  </span>
                </div>
              </div>

              {/* Stat Grid */}
              <div class="stat-grid">
                <div class="stat-box">
                  <div class="stat-box-header">
                    <span>Captures</span>
                    <NoteIcon size={14} color="var(--lime)" />
                  </div>
                  <div class="stat-box-value">{storageInfo.captures}</div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Notes, text &amp; questions</span>
                </div>

                <div class="stat-box">
                  <div class="stat-box-header">
                    <span>Contexts</span>
                    <FolderIcon size={14} color="var(--lime)" />
                  </div>
                  <div class="stat-box-value">{storageInfo.contexts}</div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Tab research sessions</span>
                </div>

                <div class="stat-box">
                  <div class="stat-box-header">
                    <span>Media Attachments</span>
                    <ScreenshotIcon size={14} color="var(--lime)" />
                  </div>
                  <div class="stat-box-value">{storageInfo.attachments}</div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Screenshots &amp; visual clips</span>
                </div>
              </div>

              {/* Storage Meter Bar */}
              <div class="storage-meter-box">
                <div class="storage-meter-label">
                  <span style={{ fontWeight: 600, color: "#ffffff" }}>Browser Storage Usage</span>
                  <span style={{ color: "var(--lime)", fontWeight: 700 }}>
                    {storageInfo.usedMB} MB estimated
                  </span>
                </div>
                <div class="storage-progress-track">
                  <div
                    class="storage-progress-fill"
                    style={{ width: `${Math.min(100, Math.max(8, parseFloat(storageInfo.usedMB) * 2))}%` }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  background: "var(--bg)",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                }}
              >
                <ShieldIcon size={14} color="var(--lime)" />
                <span>
                  All your data stays completely offline in your browser's private storage. No tracking pixels, cloud telemetry, or account sign-ins.
                </span>
              </div>
            </div>

            {/* Appearance Section */}
            <div class="settings-card">
              <div class="settings-card-header">
                <div class="settings-card-title-group">
                  <h3 class="settings-card-title">Theme &amp; Appearance</h3>
                  <span class="settings-card-subtitle">
                    Select your preferred color mode for sidepanels and extension popups
                  </span>
                </div>
              </div>

              <div class="setting-row">
                <div>
                  <div style={{ fontWeight: 550, color: "#ffffff" }}>Interface Theme</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    Premium Obsidian Black + Cyber Chartreuse palette
                  </div>
                </div>
                <select
                  class="filter-select"
                  value={settings["theme"] || "auto"}
                  onChange={(e) => saveSetting("theme", e.currentTarget.value)}
                  style={{ minWidth: 120 }}
                >
                  <option value="auto">Auto (System)</option>
                  <option value="dark">Obsidian Dark</option>
                  <option value="light">Clean Light</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Exports & Backups */}
        {activeTab === "export" && (
          <div>
            <div class="settings-card">
              <div class="settings-card-header">
                <div class="settings-card-title-group">
                  <h3 class="settings-card-title">
                    <ZipIcon size={16} color="var(--lime)" /> Export Library
                  </h3>
                  <span class="settings-card-subtitle">
                    Download full archives, structured notes, or backups without vendor lock-in
                  </span>
                </div>
              </div>

              {/* 2-Column Clean Cards Grid */}
              <div class="export-card-grid">
                {/* Hero 1: Complete ZIP */}
                <div class="export-item-card featured">
                  <div class="export-item-header">
                    <div class="export-icon-box">
                      <ZipIcon size={18} />
                    </div>
                    <div class="export-item-info">
                      <div class="export-item-title">Full ZIP Archive</div>
                      <div class="export-item-desc">
                        Includes all captures, metadata JSON, and full-resolution screenshot PNG files.
                      </div>
                    </div>
                  </div>
                  <button
                    class="btn btn-primary"
                    style={{ width: "100%", padding: "7px 12px", fontSize: 12 }}
                    onClick={handleExportZip}
                    disabled={exporting === "zip"}
                  >
                    {exporting === "zip" ? "Exporting ZIP..." : "Download Full Archive (.zip)"}
                  </button>
                </div>

                {/* Card 2: Obsidian Vault */}
                <div class="export-item-card">
                  <div class="export-item-header">
                    <div class="export-icon-box" style={{ color: "var(--lime)" }}>
                      <ObsidianIcon size={18} />
                    </div>
                    <div class="export-item-info">
                      <div class="export-item-title">Obsidian Vault</div>
                      <div class="export-item-desc">
                        YAML frontmatter, wikilinks, tags, and context folders ready to drop into Obsidian.
                      </div>
                    </div>
                  </div>
                  <button
                    class="btn"
                    style={{ width: "100%", padding: "7px 12px", fontSize: 12 }}
                    onClick={handleExportObsidian}
                    disabled={exporting === "obsidian"}
                  >
                    {exporting === "obsidian" ? "Exporting Vault..." : "Export Obsidian Vault (.zip)"}
                  </button>
                </div>

                {/* Card 3: JSON Backup */}
                <div class="export-item-card">
                  <div class="export-item-header">
                    <div class="export-icon-box">
                      <ExportIcon size={18} />
                    </div>
                    <div class="export-item-info">
                      <div class="export-item-title">Raw JSON Snapshot</div>
                      <div class="export-item-desc">
                        Machine-readable portable database snapshot for quick backup &amp; restoration.
                      </div>
                    </div>
                  </div>
                  <button
                    class="btn"
                    style={{ width: "100%", padding: "7px 12px", fontSize: 12 }}
                    onClick={handleExportJSON}
                    disabled={exporting === "json"}
                  >
                    {exporting === "json" ? "Exporting JSON..." : "Export JSON Backup (.json)"}
                  </button>
                </div>

                {/* Card 4: PDF Digest */}
                <div class="export-item-card">
                  <div class="export-item-header">
                    <div class="export-icon-box">
                      <PdfIcon size={18} />
                    </div>
                    <div class="export-item-info">
                      <div class="export-item-title">Print-Ready PDF</div>
                      <div class="export-item-desc">
                        Clean document digest formatted for printing or sharing with source links.
                      </div>
                    </div>
                  </div>
                  <button
                    class="btn"
                    style={{ width: "100%", padding: "7px 12px", fontSize: 12 }}
                    onClick={handleExportPdf}
                    disabled={exporting === "pdf"}
                  >
                    {exporting === "pdf" ? "Building PDF..." : "Export All as PDF (.pdf)"}
                  </button>
                </div>

                {/* Card 5: All Markdown */}
                <div class="export-item-card">
                  <div class="export-item-header">
                    <div class="export-icon-box">
                      <MarkdownIcon size={18} />
                    </div>
                    <div class="export-item-info">
                      <div class="export-item-title">Markdown Digest</div>
                      <div class="export-item-desc">
                        Single markdown document of all saved excerpts, quotes, and notes.
                      </div>
                    </div>
                  </div>
                  <button
                    class="btn"
                    style={{ width: "100%", padding: "7px 12px", fontSize: 12 }}
                    onClick={handleExportMarkdown}
                    disabled={exporting === "md"}
                  >
                    {exporting === "md" ? "Exporting..." : "Export Markdown (.md)"}
                  </button>
                </div>

                {/* Card 6: Markdown by Session Context */}
                <div class="export-item-card">
                  <div class="export-item-header">
                    <div class="export-icon-box">
                      <FolderIcon size={18} />
                    </div>
                    <div class="export-item-info">
                      <div class="export-item-title">Sessions as Markdown</div>
                      <div class="export-item-desc">
                        Export captures partitioned into individual documents by tab session.
                      </div>
                    </div>
                  </div>
                  <button
                    class="btn"
                    style={{ width: "100%", padding: "7px 12px", fontSize: 12 }}
                    onClick={handleExportMarkdownByContext}
                    disabled={exporting === "md-ctx"}
                  >
                    {exporting === "md-ctx" ? "Exporting..." : "Export Contexts (.md)"}
                  </button>
                </div>
              </div>
            </div>

            {/* Restore / Import Section */}
            <div class="settings-card">
              <div class="settings-card-header">
                <div class="settings-card-title-group">
                  <h3 class="settings-card-title">
                    <UploadCloudIcon size={16} color="var(--lime)" /> Restore &amp; Import
                  </h3>
                  <span class="settings-card-subtitle">
                    Restore a previously exported ContextCapture JSON backup file
                  </span>
                </div>
              </div>

              <div class="import-dropzone" onClick={handleImportBackup}>
                <UploadCloudIcon size={28} color="var(--lime)" />
                <div style={{ fontWeight: 600, color: "#ffffff", fontSize: 13 }}>
                  Click to select backup file (.json)
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                  Existing captures are preserved; duplicates are automatically detected and safely merged.
                </div>
              </div>

              {importStatus.message && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "10px 14px",
                    borderRadius: 8,
                    fontSize: 12,
                    background:
                      importStatus.phase === "error"
                        ? "rgba(239, 68, 68, 0.1)"
                        : importStatus.phase === "done"
                        ? "rgba(223, 255, 0, 0.1)"
                        : "var(--surface)",
                    color:
                      importStatus.phase === "error"
                        ? "#ef4444"
                        : importStatus.phase === "done"
                        ? "var(--lime)"
                        : "var(--text)",
                    border: `1px solid ${
                      importStatus.phase === "error"
                        ? "rgba(239, 68, 68, 0.3)"
                        : importStatus.phase === "done"
                        ? "rgba(223, 255, 0, 0.3)"
                        : "var(--border)"
                    }`,
                  }}
                >
                  {importStatus.message}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Privacy & Safety */}
        {activeTab === "privacy" && (
          <div>
            <div class="settings-card">
              <div class="settings-card-header">
                <div class="settings-card-title-group">
                  <h3 class="settings-card-title">
                    <ShieldIcon size={16} color="var(--lime)" /> Privacy Safeguards
                  </h3>
                  <span class="settings-card-subtitle">
                    Configure URL cleaning and incognito session behaviors
                  </span>
                </div>
              </div>

              <div class="setting-row">
                <div>
                  <div style={{ fontWeight: 550, color: "#ffffff" }}>Clean Tracking Parameters from URLs</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    Strips marketing trackers like <code>utm_source</code>, <code>fbclid</code>, and <code>gclid</code> from saved bookmarks.
                  </div>
                </div>
                <label class="toggle">
                  <input
                    type="checkbox"
                    checked={settings["strip_query_strings"] === "true"}
                    onChange={(e) => saveSetting("strip_query_strings", e.currentTarget.checked ? "true" : "false")}
                  />
                  <span class="toggle-slider"></span>
                </label>
              </div>

              <div class="setting-row">
                <div>
                  <div style={{ fontWeight: 550, color: "#ffffff" }}>Incognito Capture Support</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    When disabled, ContextCapture refuses to store data originating from Private/Incognito windows.
                  </div>
                </div>
                <label class="toggle">
                  <input
                    type="checkbox"
                    checked={settings["incognito_enabled"] === "true"}
                    onChange={(e) => saveSetting("incognito_enabled", e.currentTarget.checked ? "true" : "false")}
                  />
                  <span class="toggle-slider"></span>
                </label>
              </div>
            </div>

            {/* Domain Blocklist */}
            <div class="settings-card">
              <div class="settings-card-header">
                <div class="settings-card-title-group">
                  <h3 class="settings-card-title">Domain Blocklist</h3>
                  <span class="settings-card-subtitle">
                    Prevent accidental capture on sensitive personal or financial websites
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input
                  class="input"
                  value={settings["domain_blocklist"] || ""}
                  onInput={(e) => saveSetting("domain_blocklist", e.currentTarget.value)}
                  placeholder="e.g. bankofamerica.com, paypal.com, mail.google.com"
                  style={{ width: "100%", padding: 10, fontSize: 13 }}
                />
                <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                  Comma-separated domains. Captures on these websites will trigger a safety warning.
                </div>

                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Quick-add common sensitive domains:
                  </div>
                  <div class="preset-chips">
                    <button class="preset-chip" onClick={() => addBlocklistDomain("paypal.com")}>
                      + paypal.com
                    </button>
                    <button class="preset-chip" onClick={() => addBlocklistDomain("chase.com")}>
                      + chase.com
                    </button>
                    <button class="preset-chip" onClick={() => addBlocklistDomain("bankofamerica.com")}>
                      + bankofamerica.com
                    </button>
                    <button class="preset-chip" onClick={() => addBlocklistDomain("mail.google.com")}>
                      + mail.google.com
                    </button>
                    <button class="preset-chip" onClick={() => addBlocklistDomain("outlook.live.com")}>
                      + outlook.live.com
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Integrations & AI */}
        {activeTab === "integrations" && (
          <div>
            {/* Grounded AI Assistant */}
            <div class="settings-card">
              <div class="settings-card-header">
                <div class="settings-card-title-group">
                  <h3 class="settings-card-title">
                    <SparklesIcon size={16} color="var(--lime)" /> Grounded AI Knowledge Assistant
                  </h3>
                  <span class="settings-card-subtitle">
                    Local synthesis engine that answers questions strictly citing your saved library
                  </span>
                </div>
              </div>

              <div class="setting-row">
                <div>
                  <div style={{ fontWeight: 550, color: "#ffffff" }}>Enable AI Assistant in Sidepanel</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    Allows asking questions and summarizing research across tab sessions.
                  </div>
                </div>
                <label class="toggle">
                  <input
                    type="checkbox"
                    checked={settings["ai_assistant_enabled"] !== "false"}
                    onChange={(e) => saveSetting("ai_assistant_enabled", e.currentTarget.checked ? "true" : "false")}
                  />
                  <span class="toggle-slider"></span>
                </label>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  background: "var(--bg)",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  marginTop: 12,
                }}
              >
                <SparklesIcon size={14} color="var(--lime)" />
                <span>
                  Answers are grounded strictly in your captures and never sent to external servers without explicit confirmation.
                </span>
              </div>
            </div>

            {/* Webhook Integrations */}
            <div class="settings-card">
              <div class="settings-card-header">
                <div class="settings-card-title-group">
                  <h3 class="settings-card-title">Webhook Integration</h3>
                  <span class="settings-card-subtitle">
                    Dispatch captures to Notion, Zapier, Readwise, or custom endpoints
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500, display: "block", marginBottom: 4 }}>
                    Webhook Destination URL
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      class="input"
                      value={settings["webhook_url"] || ""}
                      onInput={(e) => saveSetting("webhook_url", e.currentTarget.value)}
                      placeholder="https://hooks.zapier.com/hooks/catch/... or https://your-endpoint.com"
                      style={{ flex: 1, padding: 8, fontSize: 12.5 }}
                    />
                    <button
                      class="btn"
                      onClick={handleTestWebhook}
                      style={{ fontSize: 12, padding: "6px 14px", flexShrink: 0 }}
                    >
                      Test Ping
                    </button>
                  </div>
                </div>

                {webhookTestStatus && (
                  <div style={{ fontSize: 12, color: "var(--lime)", fontWeight: 600 }}>
                    {webhookTestStatus}
                  </div>
                )}

                <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                  Captures can be dispatched individually from any capture card in the sidepanel via the export menu.
                </div>
              </div>
            </div>

            {/* Diagnostics & About */}
            <div class="settings-card">
              <div class="settings-card-header">
                <div class="settings-card-title-group">
                  <h3 class="settings-card-title">System &amp; Diagnostics</h3>
                  <span class="settings-card-subtitle">
                    Extension information and debug metadata
                  </span>
                </div>
              </div>

              <div class="setting-row">
                <span>Version</span>
                <span style={{ fontWeight: 600, color: "#ffffff" }}>1.0.0</span>
              </div>
              <div class="setting-row">
                <span>Storage Backend</span>
                <span style={{ color: "var(--text-secondary)" }}>IndexedDB (Hardware local)</span>
              </div>
              <div class="setting-row">
                <span>Repository</span>
                <a
                  href="https://github.com/raju-2313/context-capture"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--lime)", textDecoration: "none", fontWeight: 600 }}
                >
                  raju-2313/context-capture ↗
                </a>
              </div>

              <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  class="btn"
                  onClick={handleCopyDiagnostics}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}
                >
                  <CopyIcon size={13} /> Copy Diagnostic Report
                </button>
                {copyFeedback && (
                  <span style={{ fontSize: 12, color: "var(--lime)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <CheckIcon size={13} /> {copyFeedback}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

render(<Settings />, document.getElementById("root")!);
