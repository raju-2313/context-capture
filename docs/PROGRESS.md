# Progress Status

## Phase 0 & Phase 1: Local-First MVP

### Completed & Fixed
- **Build System & Packaging Fix**:
  - Identified and resolved the root cause of the raw JavaScript rendering in the extension view: Rollup `entryFileNames` was misconfigured to output JS code into `.html` files (`sidepanel/index.html`).
  - Standardized HTML entry points (`sidepanel/index.html`, `popup/index.html`, `options/index.html`, `offscreen/offscreen.html`).
  - Added Rollup Vite plugin to automatically emit clean `manifest.json` and asset bundles.
  - Enabled `"type": "module"` on background service worker in `manifest.json`.
  - Added extension icons (16, 32, 48, 128px) and mapped them in `manifest.json`.
- **Database & IndexedDB Layer**:
  - Fixed `InvalidStateError` and transaction timeouts in `src/data/db/index.ts` where `fn(transaction)` was mistakenly invoked inside `oncomplete` after the transaction finished.
  - Added global `IDBKeyRange` polyfill in `tests/setup.ts` to fix Node/Vitest test environment.
  - Verified context, capture, tag, attachment, and journal repositories with 100% passing tests.
- **UI & Views**:
  - Fixed missing `render()` invocations in `popup/index.tsx` and `options/index.tsx`.
  - Added tab tracking in `ThisTab.tsx` (`chrome.tabs.onActivated`, `chrome.tabs.onUpdated`) so the sidepanel follows active tab switches.
  - Context title now reflects real database state and updates dynamically when edited.
  - Added `Open Tab`, `Bind`, and `Restore` implementations in `Contexts.tsx`.
  - Removed external Google Fonts `@import` in `styles.css` to ensure 100% offline compliance and zero external network calls in Local Mode.
- **Injected Scripts & Shortcuts**:
  - Rewrote `src/injected/readSelection.ts` from an unused exported string into an executable IIFE returning text and anchor context.
  - Fixed `chrome.sidePanel.open` in background command handler to target active window.

### Test Verification
- `npm run typecheck`: 0 errors.
- `npm run test`: 5 test suites passed, 24 unit tests passed.
- `npm run build`: Vite build passes, outputs clean HTML, JS, CSS, and manifest in `dist/`.
