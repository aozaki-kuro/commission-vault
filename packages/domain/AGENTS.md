# AGENTS

`packages/domain` holds shared domain types and pure business-facing contracts.

## Tree

- `src/content.ts`: public content model types shared by data loaders and rendering code.
- `src/aliases.ts`: shared alias entry/admin row types.
- `src/admin.ts`: admin-facing DTO and bootstrap payload types.
- `src/search.ts`: search/suggestion type contracts.
- `src/index.ts`: single export surface for the package.

## Boundaries

- Keep this package runtime-light and app-agnostic.
- Put pure types and pure logic here; do not import from `apps/*`.
