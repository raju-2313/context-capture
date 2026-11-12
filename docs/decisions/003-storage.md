# ADR 003: Storage - IndexedDB

## Decision
Use IndexedDB for all structured data and attachments (blobs).

## Alternatives
- chrome.storage.local (small quota, ~5MB, not for blobs)
- chrome.storage.session (session-scoped, for bindings only)
- Origin Private File System (OPFS) - evaluated but not selected for MVP
- WebSQL (deprecated)

## Selected Approach
IndexedDB with native Promise wrapper, stores: contexts, captures, attachments, capture_attachments, tags, capture_tags, change_journal, settings, meta.

## Reasoning
- Structured data plus blobs; available in extension pages and service workers
- No practical size limit for local-first MVP
- Supports transactions for multi-store writes
- chrome.storage.session used for tab-to-context bindings (session-scoped)

## Trade-offs
- IndexedDB API is callback-based; wrapped in Promises
- Can be blocked by quota or corruption
- async/await pattern required

## Future Consequences
- OPFS can be evaluated later for attachment storage if IndexedDB hits limits
- Change journal maintained from Phase 1 for future sync
