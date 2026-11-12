# ADR 001: Manifest V3

## Decision
Use Chrome Manifest V3 for the extension.

## Alternatives
- Manifest V2 (deprecated, will be removed from Chrome Web Store)
- Manifest V3 (current standard)

## Selected Approach
Manifest V3 with service worker background model.

## Reasoning
- Current Chrome standard; required for new store submissions
- Service-worker background model shapes the architecture (stateless, event-driven)
- Side panel API available in MV3 (Chrome 114+)

## Trade-offs
- Service worker terminates when idle; no persistent in-memory state
- All state must live in IndexedDB or chrome.storage.session
- Event listeners must be registered synchronously at module initialisation

## Future Consequences
- Long jobs (export, PDF) must run in offscreen documents
- Context bindings must be rebuilt on service worker restart
- Capture pipeline must be idempotent and transactional
