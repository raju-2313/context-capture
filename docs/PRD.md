# ContextCapture - PRD (Markdown Copy)

Source: PRD Browser Context Capture Extension.docx (Draft v1.0, 12 November 2026)

This file is a working reference copy. The original .docx remains the source of truth.

Key sections implemented in Phase 1:
- Section 5: Core Product Concepts and Terminology
- Section 8: Detailed Capture System Specification
- Section 9: Tab Context and Project Management
- Section 13: Privacy and Security
- Section 14: Technical Architecture
- Section 15: Data Model
- Section 17: Non-Functional Requirements
- Section 19: Phase-by-Phase Implementation Scope
- Section 21: Testing and Quality Assurance
- Section 26: Open Questions and Assumptions
- Section 27: Definition of Done
- Section 28: Phase 1 Build Specification

Phase 1 scope (exact):
- Chrome extension (Manifest V3), side panel plus options page plus quick-add popup
- Onboarding (one screen) and no-login usage
- Per-tab Browser Contexts with stable IDs, archive on close, restore and manual rebind, confident auto-rebind after restart [Spike-dependent]
- Capture types: selected text, code snippet (selection flagged as code), link/page reference, question, note, screenshot (visible viewport; region crop [Spike-dependent, P1])
- Automatic metadata: URL, title, domain, favicon, timestamp, context ID
- User note on any capture; tags
- Views: This Tab, All, Contexts (active and archived), Capture detail
- Filters: type, domain, context, tag, date; keyword search
- Open source page
- Export: Markdown (capture, context, selection), PDF (capture, context, selection), JSON/ZIP full backup, backup import
- Settings: storage usage, shortcuts info, privacy (blocklist, URL stripping option, incognito switch), export/backup, about
- Essential error handling and recovery

Explicit exclusions from Phase 1:
- Accounts, sign-in, cloud storage, sync, server of any kind
- Projects and project memberships (tables are not created; design only)
- OCR, semantic search, related captures, AI of any kind, summaries, Q&A
- Voice capture and transcription
- Full-page (scrolling) screenshots; saving full webpage copies; readable-content extraction
- Text-fragment "open and highlight" behaviour
- Integrations with Notion, Apple Notes, Google Keep, Obsidian (beyond Markdown files), OneNote, Drive
- Team or sharing features
- Firefox, Safari, mobile browsers
- Rich text editor, annotation drawing on screenshots, in-page overlay UI, in-page highlighting
- Telemetry beyond opt-in beta counters
- Automation, tasks and reminders
