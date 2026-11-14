# ContextCapture (Chrome Extension)

Capture anything while browsing. Preserve tab context. Find it again. Local-first, privacy-respecting, with optional managed transcription.

## Features (Phase 1 Local MVP)

- **Manifest V3 Extension**: Built with TypeScript, Preact, and Vite.
- **Tab-Specific Browser Contexts**:
  - Independent capture spaces per browser tab.
  - Automatic Context title generation based on captured page title.
  - User-editable titles.
  - Context archive on tab close, restore, and manual rebind.
- **Unified Capture Pipeline**:
  - Selected text with prefix/suffix context anchor.
  - Screenshots of visible viewport with SHA-256 deduplication.
  - Webpage links and code snippets.
  - Quick notes and questions.
- **Side Panel Interface**:
  - **This Tab**: Follows active browser tab, showing captures tied to the current context.
  - **All**: Unified search and filter view across all captures by keyword, type, or domain.
  - **Contexts**: Browse and switch between Active and Archived contexts.
  - **Settings**: View local storage statistics, manage blocklists, and export data.
- **Local-First & Offline**:
  - IndexedDB storage with ACID transactions.
  - Zero extension-initiated network calls in Local Mode.
  - JSON backup export and diagnostic copy.
- **Managed transcription (optional)**:
  - Audio uploads only after Stop, through an owner-operated Supabase Edge Function.
  - The Groq/provider key remains a Supabase secret and is never bundled or stored in extension client configuration.
  - Anonymous Supabase auth identifies users; server-side plans, quotas, request IDs, size/duration limits, and Stripe subscription state control usage.

## Building the Extension

### Prerequisites
- Node.js >= 18
- npm

### Development & Build Commands

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run tests**:
   ```bash
   npm test
   ```

3. **Typecheck**:
   ```bash
   npm run typecheck
   ```

4. **Build the extension**:
   ```bash
   npm run build
   ```
   The built extension output is placed in the `dist/` directory.

## Managed transcription setup

1. Create a Supabase project and enable anonymous sign-ins.
2. Link this repository with the Supabase CLI, apply `supabase/migrations/20261114000000_managed_transcription.sql`, and deploy `transcribe`, `create-checkout`, and `stripe-webhook`.
3. Set Edge Function secrets (never commit these values):
   ```bash
   supabase secrets set GROQ_API_KEY=... STRIPE_SECRET_KEY=... STRIPE_WEBHOOK_SECRET=... STRIPE_PRICE_ID=... STRIPE_SUCCESS_URL=... STRIPE_CANCEL_URL=... TRANSCRIPTION_UPGRADE_URL=...
   supabase functions deploy transcribe --no-verify-jwt
   supabase functions deploy create-checkout --no-verify-jwt
   supabase functions deploy stripe-webhook --no-verify-jwt
   ```
4. Configure the gateway URL (`https://YOUR_PROJECT.supabase.co/functions/v1`), Supabase project URL, public anonymous key, and upgrade URL in extension Settings. Only the public anonymous key belongs in extension settings.
5. In Stripe, create the recurring price from `STRIPE_PRICE_ID` and point the webhook endpoint at `stripe-webhook`; subscribe to checkout completion and subscription update/deletion events. Checkout success alone does not grant paid access.

The typed gateway, quota SQL/RLS, checkout seam, and signed webhook verification are included. Stripe price/customer identifiers and Supabase project identifiers are owner-specific manual setup inputs; no payment success is faked locally.

## Loading into Chrome / Brave / Edge

1. Open your browser and navigate to:
   - Chrome: `chrome://extensions`
   - Brave: `brave://extensions`
   - Edge: `edge://extensions`
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Select the `dist` folder located inside this project directory (`d:\Extenstion\dist`).
5. If you already had the extension loaded, click the **Reload** (refresh) icon on the extension card.
6. Click the extension icon in your toolbar to open the Quick Add popup or press `Ctrl+Shift+P` to open the Side Panel.

## Keyboard Shortcuts

- `Ctrl+Shift+C`: Capture selected text on active tab
- `Ctrl+Shift+S`: Capture screenshot of visible tab
- `Ctrl+Shift+N`: Open Quick Note
- `Ctrl+Shift+P`: Open Side Panel

