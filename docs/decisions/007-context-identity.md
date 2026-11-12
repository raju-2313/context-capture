# ADR 007: Context Identity - UUID with Session Bindings

## Decision
Use product-owned UUIDs for Context identity; tab-to-context bindings live in chrome.storage.session only.

## Alternatives
- Use Chrome tabId as context identifier (not stable across restarts)
- Use tabId + windowId composite (still session-scoped)
- Product UUID with persistent binding store

## Selected Approach
context_id (UUID) is permanent identity; Binding { tab_id, window_id, context_id, bound_at } lives in storage.session only.

## Reasoning
- Chrome tab IDs are session-scoped and not stable across restarts [Verified]
- Context persists until user deletes it; survives tab close and browser restart
- Bindings rebuilt on startup via reconciliation scan
- No need for tabs permission to track bindings

## Trade-offs
- Tab-to-context mapping lost on browser restart; rebuilt from events
- Auto-rebind after session restore relies on URL matching (confident match only)
- Ambiguous matches never auto-bind; user is shown a chooser

## Future Consequences
- Sync (Phase 2B) never syncs bindings; contexts sync independently
- Context merge is explicit user action, rewrites context_id, recorded in change journal
