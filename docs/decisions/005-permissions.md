# ADR 005: Permissions - Minimum Set

## Decision
Request only: activeTab, scripting, contextMenus, storage, sidePanel, downloads, offscreen.

## Alternatives
- Add tabs permission (broad host access warning at install)
- Add <all_urls> host permissions (privacy concern, store rejection risk)
- Add history permission (privacy concern)

## Selected Approach
Minimum permission set with no host permissions. Everything is gesture-based (activeTab after user interaction).

## Reasoning
- Privacy-preserving default (PRV-005, PRV-006)
- No install-time permission warning for activeTab [Verified]
- activeTab grants temporary access to the active tab after a user gesture
- scripting needed in addition to activeTab for injection [Verified]
- tabs permission deferred; only add if Phase 0 spike proves it's needed for rebinding

## Trade-offs
- Cannot read tab URL without user gesture (except at capture time)
- Session-restore rebinding may be less reliable without tabs permission
- Must track last_url only when a capture happens, not on every navigation

## Future Consequences
- If tabs permission is later needed, install warning must be justified in store listing
- Rebinding after session restore relies on URL matching at capture time
