# ContextCapture - Build Plan

## Phase 0: Foundation and Spikes (in progress)

### Spikes
1. Tab context identity and lifecycle - Prototype stable context IDs, close/restore behaviour
2. Screenshot capture - Viewport capture, region crop, rate behaviour
3. Service worker resilience - Kill and restart during capture
4. Storage and search scale - 10,000 captures, search performance
5. Export - Markdown, ZIP, PDF generation

### Decision Records
- docs/decisions/001-manifest-v3.md
- docs/decisions/002-ui-framework.md
- docs/decisions/003-storage.md
- docs/decisions/004-search-library.md
- docs/decisions/005-permissions.md
- docs/decisions/006-attachment-store.md

### Exit Criteria
- Spike reports with pass/fail against Section 17 targets
- Signed-off schema
- Permission list
- Prototype feedback summarised

## Phase 1: Local-first MVP

### Implementation Order
1. Project scaffold, DB layer with migrations and change journal, message bus, settings
2. Context manager and capture pipeline (text, note, question, link)
3. Side panel: This Tab and All views, capture cards, notes and tags
4. Screenshot capture, thumbnails, optional region crop
5. Search index, filters
6. Archive, restore and rebind flows
7. Export: Markdown, then ZIP/JSON backup and import, then PDF
8. Onboarding, empty states, storage and settings screens, error handling
9. Hardening: resilience, privacy, accessibility, performance runs
10. Closed beta, metrics and interviews

### Acceptance Criteria A1-A18
All Phase 1 P0 requirements must meet acceptance criteria (Section B9 of PRD).

## Phase 2A: Projects (local) - Future
## Phase 2B: Accounts and sync - Future
