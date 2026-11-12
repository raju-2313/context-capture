# ADR 002: UI Framework - Preact

## Decision
Use Preact with Vite for the frontend UI.

## Alternatives
- React (larger bundle, more mature ecosystem)
- Preact (smaller bundle, React-compatible API)
- Vanilla JS (no build step, more verbose)

## Selected Approach
Preact with @vitejs/plugin-preact.

## Reasoning
- Side panel is a full web app; framework helps with component structure
- Smaller bundle size matters for extension installation and load time
- Preact is React-compatible, so most React patterns apply
- Vite provides fast dev server and production builds

## Trade-offs
- Smaller community than React
- Some React ecosystem libraries may not work with Preact

## Future Consequences
- All UI code uses Preact patterns (h, hooks)
- Compatible with React dev tools via preact/debug
