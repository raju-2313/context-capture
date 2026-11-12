# ContextCapture - Testing

## Test Layers
1. Unit - Pure logic (capture validation, context binding rules, URL normalisation, export formatting) - Vitest
2. Integration - Repository against real IndexedDB, migrations, export-import round trip - Vitest + jsdom
3. Extension E2E - Real Chrome with extension loaded - Playwright/Puppeteer
4. Resilience - Service worker kill during capture, browser restart, quota exhaustion
5. Performance - Seeded datasets (1k, 10k, 20k captures) with timing budgets
6. Privacy - Network capture during Local Mode: zero requests
7. Accessibility - Keyboard-only runs, axe checks

## Commands
- `npm test` - Run unit tests
- `npm run typecheck` - TypeScript type checking
- `npm run lint` - ESLint

## Current Status
Tests not yet written.
