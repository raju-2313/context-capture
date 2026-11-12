/**
 * ContextCapture - In-Page Floating Selection Tooltip & Action Menu
 * Modern Dark Craft Aesthetic (inspired by puvio.app)
 * Isolated inside an attached Shadow DOM so host styles cannot interfere.
 */

(() => {
  // Guard against double injection
  if ((window as any).__CC_SELECTION_TOOLTIP_LOADED__) return;
  (window as any).__CC_SELECTION_TOOLTIP_LOADED__ = true;

  const HOST_ID = "cc-selection-tooltip-host";
  let hostEl: HTMLElement | null = null;
  let shadowRoot: ShadowRoot | null = null;
  let currentSelectionText = "";
  let isExpanded = false;
  let debounceTimer: any = null;

  function ensureHost(): ShadowRoot {
    if (shadowRoot && hostEl && document.documentElement.contains(hostEl)) {
      return shadowRoot;
    }

    // Clean up any stale host
    const existing = document.getElementById(HOST_ID);
    if (existing) existing.remove();

    hostEl = document.createElement("div");
    hostEl.id = HOST_ID;
    hostEl.style.position = "absolute";
    hostEl.style.top = "0px";
    hostEl.style.left = "0px";
    hostEl.style.width = "0px";
    hostEl.style.height = "0px";
    hostEl.style.overflow = "visible";
    hostEl.style.zIndex = "2147483647";
    hostEl.style.pointerEvents = "none";

    document.documentElement.appendChild(hostEl);
    shadowRoot = hostEl.attachShadow({ mode: "open" });
    shadowRoot.innerHTML = getStyles() + `<div id="cc-container" class="cc-container"></div>`;
    return shadowRoot;
  }

  function getStyles(): string {
    return `
      <style>
        :host {
          all: initial;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", "Helvetica Neue", sans-serif;
          font-size: 13px;
          line-height: 1.4;
          color: #f4f4f5;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        *, *::before, *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        .cc-container {
          position: absolute;
          pointer-events: auto;
          user-select: none;
          -webkit-user-select: none;
          z-index: 2147483647;
          display: none;
          animation: ccPopIn 0.16s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes ccPopIn {
          0% {
            opacity: 0;
            transform: translateY(6px) scale(0.95);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes ccFadeOut {
          0% {
            opacity: 1;
            transform: scale(1);
          }
          100% {
            opacity: 0;
            transform: scale(0.92);
          }
        }

        /* --- Floating Action Pill (Matches screenshot) --- */
        .cc-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 32px;
          padding: 0 10px 0 8px;
          background: rgba(13, 14, 20, 0.94);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 9999px;
          box-shadow: 0 8px 24px -2px rgba(0, 0, 0, 0.6),
                      0 0 0 1px rgba(255, 255, 255, 0.05),
                      0 2px 6px rgba(0, 0, 0, 0.4);
          cursor: pointer;
          transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
          color: #ffffff;
        }

        .cc-pill:hover {
          background: rgba(22, 24, 34, 0.98);
          border-color: rgba(99, 102, 241, 0.5);
          transform: translateY(-1px);
          box-shadow: 0 12px 28px -2px rgba(0, 0, 0, 0.7),
                      0 0 16px -2px rgba(99, 102, 241, 0.4);
        }

        .cc-pill-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          color: #818cf8;
        }

        .cc-pill-label {
          font-size: 12.5px;
          font-weight: 600;
          letter-spacing: -0.01em;
          color: #ffffff;
        }

        .cc-pill-chevron {
          display: flex;
          align-items: center;
          color: rgba(255, 255, 255, 0.45);
          transition: transform 0.15s ease;
        }

        .cc-pill:hover .cc-pill-chevron {
          color: #818cf8;
          transform: translateY(1px);
        }

        /* --- Expanded Menu Card (Puvio Dark Craft) --- */
        .cc-menu {
          width: 270px;
          background: rgba(12, 13, 18, 0.96);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 14px;
          box-shadow: 0 20px 48px -6px rgba(0, 0, 0, 0.75),
                      0 0 0 1px rgba(255, 255, 255, 0.05),
                      0 0 24px -4px rgba(99, 102, 241, 0.15);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .cc-menu-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px 8px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .cc-menu-title {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .cc-brand-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #6366f1;
          box-shadow: 0 0 8px #6366f1;
        }

        .cc-title-text {
          font-size: 11.5px;
          font-weight: 650;
          letter-spacing: 0.02em;
          color: #e4e4e7;
          text-transform: uppercase;
        }

        .cc-close-btn {
          background: transparent;
          border: none;
          color: #71717a;
          cursor: pointer;
          font-size: 13px;
          padding: 2px 4px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.1s ease, background 0.1s ease;
        }

        .cc-close-btn:hover {
          color: #f4f4f5;
          background: rgba(255, 255, 255, 0.08);
        }

        .cc-preview-box {
          padding: 8px 14px;
          background: rgba(0, 0, 0, 0.25);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          font-size: 11.5px;
          color: #a1a1aa;
          font-style: italic;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .cc-actions-list {
          padding: 6px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .cc-action-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 7px 10px;
          background: transparent;
          border: none;
          border-radius: 8px;
          color: #f4f4f5;
          cursor: pointer;
          text-align: left;
          transition: all 0.12s ease;
        }

        .cc-action-item:hover {
          background: rgba(255, 255, 255, 0.07);
          transform: translateX(2px);
        }

        .cc-action-item.cc-item-ai {
          background: rgba(99, 102, 241, 0.09);
          border: 1px solid rgba(99, 102, 241, 0.2);
        }

        .cc-action-item.cc-item-ai:hover {
          background: rgba(99, 102, 241, 0.18);
          border-color: rgba(99, 102, 241, 0.4);
        }

        .cc-item-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.05);
          color: #a1a1aa;
          flex-shrink: 0;
          transition: all 0.12s ease;
        }

        .cc-action-item:hover .cc-item-icon {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.1);
        }

        .cc-action-item.cc-item-ai .cc-item-icon {
          background: rgba(99, 102, 241, 0.22);
          color: #818cf8;
        }

        .cc-item-body {
          flex: 1;
          min-width: 0;
        }

        .cc-item-title {
          font-size: 12.5px;
          font-weight: 550;
          color: #ffffff;
          line-height: 1.2;
        }

        .cc-item-desc {
          font-size: 10.5px;
          color: #a1a1aa;
          margin-top: 1px;
        }

        .cc-item-badge {
          font-size: 9.5px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 4px;
          background: rgba(99, 102, 241, 0.2);
          color: #a5b4fc;
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }

        .cc-menu-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 7px 14px 9px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          background: rgba(0, 0, 0, 0.2);
          font-size: 10px;
          color: #71717a;
        }

        .cc-sidepanel-hint {
          color: #818cf8;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 2px;
        }

        /* --- Status Toast Banner inside Tooltip --- */
        .cc-status-toast {
          padding: 12px 14px;
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(16, 185, 129, 0.12);
          border: 1px solid rgba(16, 185, 129, 0.3);
          border-radius: 12px;
          color: #34d399;
          font-size: 12px;
          font-weight: 550;
          animation: ccPopIn 0.14s ease forwards;
        }
      </style>
    `;
  }

  function getSelectionInfo(): { text: string; rect: DOMRect | null } {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      return { text: "", rect: null };
    }
    const text = sel.toString().trim();
    if (text.length < 2) {
      return { text: "", rect: null };
    }
    try {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        return { text: "", rect: null };
      }
      return { text, rect };
    } catch {
      return { text: "", rect: null };
    }
  }

  function positionContainer(container: HTMLElement, rect: DOMRect) {
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    // Calculate center-bottom of selection
    let left = rect.left + scrollX + rect.width / 2;
    let top = rect.bottom + scrollY + 8;

    // If near bottom of viewport, place above
    const estimatedHeight = isExpanded ? 260 : 36;
    if (rect.bottom + estimatedHeight + 20 > window.innerHeight && rect.top > estimatedHeight + 20) {
      top = rect.top + scrollY - estimatedHeight - 8;
    }

    // Keep horizontal bounds within screen
    const estimatedWidth = isExpanded ? 270 : 90;
    const minLeft = scrollX + 16;
    const maxLeft = scrollX + window.innerWidth - estimatedWidth - 16;
    left = Math.max(minLeft, Math.min(maxLeft, left - (isExpanded ? 135 : 45)));

    container.style.left = `${Math.round(left)}px`;
    container.style.top = `${Math.round(top)}px`;
  }

  function renderPill(container: HTMLElement, rect: DOMRect) {
    isExpanded = false;
    positionContainer(container, rect);
    container.style.display = "block";

    container.innerHTML = `
      <div class="cc-pill" id="cc-pill-btn" title="ContextCapture Actions">
        <div class="cc-pill-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
          </svg>
        </div>
        <span class="cc-pill-label">Ask</span>
        <div class="cc-pill-chevron">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>
    `;

    const pillBtn = container.querySelector("#cc-pill-btn");
    pillBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      renderMenu(container, rect);
    });
  }

  function renderMenu(container: HTMLElement, rect: DOMRect) {
    isExpanded = true;
    positionContainer(container, rect);

    const previewSnippet = currentSelectionText.length > 55
      ? currentSelectionText.slice(0, 55).replace(/\s+/g, " ") + "..."
      : currentSelectionText.replace(/\s+/g, " ");

    container.innerHTML = `
      <div class="cc-menu" id="cc-menu-card">
        <div class="cc-menu-header">
          <div class="cc-menu-title">
            <span class="cc-brand-dot"></span>
            <span class="cc-title-text">ContextCapture</span>
          </div>
          <button class="cc-close-btn" id="cc-close" title="Dismiss">✕</button>
        </div>

        <div class="cc-preview-box">
          "${escapeHtml(previewSnippet)}"
        </div>

        <div class="cc-actions-list">
          <button class="cc-action-item" data-action="highlight">
            <div class="cc-item-icon">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m9 11-6 6v3h3l6-6"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>
              </svg>
            </div>
            <div class="cc-item-body">
              <div class="cc-item-title">Highlight & Save</div>
              <div class="cc-item-desc">Save text to tab context</div>
            </div>
            <span class="cc-item-badge">Save</span>
          </button>

          <button class="cc-action-item" data-action="note">
            <div class="cc-item-icon">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
              </svg>
            </div>
            <div class="cc-item-body">
              <div class="cc-item-title">Add to Notes</div>
              <div class="cc-item-desc">Save selection as a note</div>
            </div>
          </button>

          <button class="cc-action-item" data-action="question">
            <div class="cc-item-icon">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div class="cc-item-body">
              <div class="cc-item-title">Ask as Question</div>
              <div class="cc-item-desc">Flag to investigate or answer</div>
            </div>
          </button>

          <button class="cc-action-item cc-item-ai" data-action="ask-ai">
            <div class="cc-item-icon">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>
              </svg>
            </div>
            <div class="cc-item-body">
              <div class="cc-item-title">Ask AI / Explain</div>
              <div class="cc-item-desc">Get instant grounded answer</div>
            </div>
            <span class="cc-item-badge" style="background: rgba(99,102,241,0.25); color: #c7d2fe;">AI ↗</span>
          </button>

          <button class="cc-action-item" data-action="copy">
            <div class="cc-item-icon">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
              </svg>
            </div>
            <div class="cc-item-body">
              <div class="cc-item-title">Copy Clean Text</div>
              <div class="cc-item-desc">Copy without unwanted formatting</div>
            </div>
          </button>
        </div>

        <div class="cc-menu-footer">
          <span>🔒 Local-first</span>
          <span class="cc-sidepanel-hint">Dedicated Side Panel ↗</span>
        </div>
      </div>
    `;

    // Hook up buttons
    container.querySelector("#cc-close")?.addEventListener("click", (e) => {
      e.stopPropagation();
      hideTooltip();
    });

    const items = container.querySelectorAll(".cc-action-item");
    items.forEach((item) => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const action = (item as HTMLElement).dataset["action"];
        handleAction(action, container);
      });
    });
  }

  function handleAction(action: string | undefined, container: HTMLElement) {
    if (!action || !currentSelectionText) return;
    const textToCapture = currentSelectionText;

    switch (action) {
      case "highlight": {
        showToast(container, "✓ Saved to Tab Context");
        try {
          chrome.runtime.sendMessage({
            id: crypto.randomUUID(),
            type: "CAPTURE_TEXT",
            timestamp: Date.now(),
            payload: { text: textToCapture, tabId: 0, windowId: 0 },
          });
          chrome.runtime.sendMessage({
            id: crypto.randomUUID(),
            type: "OPEN_PANEL",
            timestamp: Date.now(),
            payload: { targetTab: "thistab" },
          });
        } catch (e) {
          console.warn("[ContextCapture] Error capturing text", e);
        }
        setTimeout(hideTooltip, 750);
        break;
      }
      case "note": {
        showToast(container, "✓ Saved to Notes");
        try {
          chrome.runtime.sendMessage({
            id: crypto.randomUUID(),
            type: "CAPTURE_NOTE",
            timestamp: Date.now(),
            payload: { text: textToCapture, tabId: null, windowId: null },
          });
          chrome.runtime.sendMessage({
            id: crypto.randomUUID(),
            type: "OPEN_PANEL",
            timestamp: Date.now(),
            payload: { targetTab: "thistab" },
          });
        } catch (e) {
          console.warn("[ContextCapture] Error capturing note", e);
        }
        setTimeout(hideTooltip, 750);
        break;
      }
      case "question": {
        showToast(container, "✓ Saved Question");
        try {
          chrome.runtime.sendMessage({
            id: crypto.randomUUID(),
            type: "CAPTURE_QUESTION",
            timestamp: Date.now(),
            payload: { text: textToCapture, tabId: null, windowId: null },
          });
          chrome.runtime.sendMessage({
            id: crypto.randomUUID(),
            type: "OPEN_PANEL",
            timestamp: Date.now(),
            payload: { targetTab: "thistab" },
          });
        } catch (e) {
          console.warn("[ContextCapture] Error capturing question", e);
        }
        setTimeout(hideTooltip, 750);
        break;
      }
      case "ask-ai": {
        showToast(container, "✓ Opening AI Assistant...");
        try {
          const prefill = textToCapture.length > 250
            ? `Explain this: "${textToCapture.slice(0, 250)}..."`
            : `Explain this: "${textToCapture}"`;
          chrome.runtime.sendMessage({
            id: crypto.randomUUID(),
            type: "OPEN_PANEL",
            timestamp: Date.now(),
            payload: {
              targetTab: "assistant",
              prefillQuery: prefill,
            },
          });
        } catch (e) {
          console.warn("[ContextCapture] Error opening AI assistant", e);
        }
        setTimeout(hideTooltip, 600);
        break;
      }
      case "copy": {
        navigator.clipboard.writeText(textToCapture).then(() => {
          showToast(container, "✓ Copied Clean Text!");
          setTimeout(hideTooltip, 600);
        }).catch(() => {
          showToast(container, "Failed to copy");
          setTimeout(hideTooltip, 600);
        });
        break;
      }
    }
  }

  function showToast(container: HTMLElement, message: string) {
    container.innerHTML = `
      <div class="cc-status-toast">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>${escapeHtml(message)}</span>
      </div>
    `;
  }

  function hideTooltip() {
    if (!shadowRoot) return;
    const container = shadowRoot.querySelector("#cc-container") as HTMLElement;
    if (container) {
      container.style.display = "none";
      container.innerHTML = "";
    }
    isExpanded = false;
  }

  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function updateTooltip() {
    const { text, rect } = getSelectionInfo();
    if (!text || !rect) {
      hideTooltip();
      currentSelectionText = "";
      return;
    }

    currentSelectionText = text;
    const shadow = ensureHost();
    const container = shadow.querySelector("#cc-container") as HTMLElement;
    if (!container) return;

    if (!isExpanded) {
      renderPill(container, rect);
    } else {
      positionContainer(container, rect);
    }
  }

  // --- Event Listeners ---
  document.addEventListener("mouseup", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(updateTooltip, 120);
  });

  document.addEventListener("selectionchange", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.toString().trim().length === 0) {
        hideTooltip();
      }
    }, 150);
  });

  document.addEventListener("mousedown", (e) => {
    // If click is outside shadow host, dismiss
    const target = e.target as HTMLElement;
    if (hostEl && hostEl.contains(target)) return;
    // Composed path for shadow boundary
    const path = e.composedPath ? e.composedPath() : [];
    if (path.includes(hostEl as EventTarget)) return;

    hideTooltip();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      hideTooltip();
    }
  });

  window.addEventListener("scroll", () => {
    if (!isExpanded && shadowRoot) {
      // Reposition pill or hide if selection cleared
      const { text, rect } = getSelectionInfo();
      const container = shadowRoot.querySelector("#cc-container") as HTMLElement;
      if (text && rect && container && container.style.display !== "none") {
        positionContainer(container, rect);
      }
    }
  }, { passive: true });
})();
