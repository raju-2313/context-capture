# ADR 006: Attachment Store - IndexedDB Blobs

## Decision
Store attachments (screenshots) as Blobs in IndexedDB attachments store.

## Alternatives
- IndexedDB blobs (selected)
- Origin Private File System (OPFS) - deferred to spike
- IndexedDB + file system access API (not available in extensions)

## Selected Approach
IndexedDB with attachments store containing blob, thumb, sha256, mime, size, dimensions.

## Reasoning
- Simpler single-store approach; blobs available in extension pages and service workers
- Content-addressed by SHA-256 for deduplication
- Thumbnails generated for list views; originals never replaced
- OPFS evaluated in Phase 0 spike but not required for MVP

## Trade-offs
- IndexedDB blob storage can be slower than OPFS for very large files
- Quota management needed; unlimitedStorage permission considered
- Blob retrieval requires async IDB operations

## Future Consequences
- If attachment store grows large, migrate to OPFS or hybrid approach
- SHA-256 content addressing enables deduplication across captures
