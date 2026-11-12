import { useState } from "preact/hooks";
import ThisTab from "./views/ThisTab";
import All from "./views/All";
import Contexts from "./views/Contexts";

type Tab = "thistab" | "all" | "contexts" | "settings";

export default function SidePanelApp() {
  const [activeTab, setActiveTab] = useState<Tab>("thistab");

  return (
    <div class="container">
      <div class="header">
        <div class="app-title">ContextCapture</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            class="btn btn-icon"
            title="Options & Settings"
            onClick={() => chrome.runtime.openOptionsPage()}
          >
            &#9881;
          </button>
        </div>
      </div>
      <nav class="nav-tabs">
        <button
          class={`tab ${activeTab === "thistab" ? "active" : ""}`}
          onClick={() => setActiveTab("thistab")}
        >
          This Tab
        </button>
        <button
          class={`tab ${activeTab === "all" ? "active" : ""}`}
          onClick={() => setActiveTab("all")}
        >
          All
        </button>
        <button
          class={`tab ${activeTab === "contexts" ? "active" : ""}`}
          onClick={() => setActiveTab("contexts")}
        >
          Contexts
        </button>
        <button
          class={`tab ${activeTab === "settings" ? "active" : ""}`}
          onClick={() => setActiveTab("settings")}
        >
          Settings
        </button>
      </nav>
      <div class="content">
        {activeTab === "thistab" && <ThisTab />}
        {activeTab === "all" && <All />}
        {activeTab === "contexts" && <Contexts />}
        {activeTab === "settings" && (
          <div class="empty-state" style={{ height: "auto", padding: 20 }}>
            <h3>Settings</h3>
            <p style={{ marginTop: 8, marginBottom: 16 }}>
              Manage privacy blocklist, storage usage, and data export.
            </p>
            <button
              class="btn btn-primary"
              onClick={() => chrome.runtime.openOptionsPage()}
            >
              Open Full Settings Page
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
