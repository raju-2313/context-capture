import { useState, useEffect } from "preact/hooks";
import { render } from "preact/compat";
import { settingsStore } from "../../data/settings";
import { captures as capRepo, contexts as ctxRepo, attachments as attRepo } from "../../data/repositories";
import { exportEngine } from "../../core/export";

export default function Settings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [storageInfo, setStorageInfo] = useState({ captures: 0, contexts: 0, attachments: 0, size: 0 });

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
    setStorageInfo({ captures: caps, contexts: ctxs, attachments: atts, size: 0 });
  }

  async function saveSetting(key: string, value: string) {
    await settingsStore.set(key, value);
    setSettings({ ...settings, [key]: value });
  }

  return (
    <div class="container">
      <div class="header">
        <div class="app-title">Settings</div>
      </div>
      <div class="content">
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
        </div>

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
          <div class="setting-row">
            <span>Domain blocklist</span>
            <input
              class="input"
              value={settings["domain_blocklist"] || ""}
              onBlur={(e) => saveSetting("domain_blocklist", e.currentTarget.value)}
            />
            <div style={{ fontSize: 11, color: "#86868b", marginTop: 4 }}>Comma-separated domains. Captures from these domains will be warned.</div>
          </div>
        </div>

        <div class="settings-section">
          <h4>Export &amp; Backup</h4>
          <div class="setting-row">
            <button class="btn btn-primary" style={{ width: "100%" }} onClick={async () => {
              const blob = await exportEngine.exportBackup();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `contextcapture-backup-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}>Export JSON Backup</button>
          </div>
        </div>

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
            <button class="btn" style={{ width: "100%" }} onClick={() => {
              const diag = JSON.stringify({
                version: "1.0.0",
                storage: storageInfo,
                settings,
                userAgent: navigator.userAgent,
                timestamp: new Date().toISOString()
              }, null, 2);
              navigator.clipboard.writeText(diag);
              alert("Diagnostics copied to clipboard!");
            }}>Copy diagnostics</button>
          </div>
        </div>
      </div>
    </div>
  );
}

render(<Settings />, document.getElementById("root")!);
