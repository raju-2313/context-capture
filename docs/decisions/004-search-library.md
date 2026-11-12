# ADR 004: Search Library - Custom In-Memory Index

## Decision
Use a custom in-memory inverted index built from IndexedDB data, persisted incrementally.

## Alternatives
- lunr.js (small FTS library, bundle dependency)
- flexsearch (fast, no dependencies, larger bundle)
- IndexedDB-backed FTS (complex, slower)
- Naive substring scan (doesn't scale to 10,000 captures)

## Selected Approach
Custom in-memory inverted index with tokenization (lowercase, diacritic stripping, punctuation removal).

## Reasoning
- PRD recommends not relying on naive substring scans beyond a few thousand records
- In-memory index gives sub-300ms search for 10,000 captures
- Rebuilt on startup, updated incrementally on capture/edit/delete
- No extra dependency; full control over tokenization and scoring

## Trade-offs
- Index held in memory; must be rebuilt on service worker restart
- Index drift possible if writes bypass the search index module
- Diacritic-insensitive matching via stripDiacritics utility

## Future Consequences
- Can swap to lunr.js or flexsearch later if more advanced search needed
- OCR text (Phase 3) can be added to the same index
