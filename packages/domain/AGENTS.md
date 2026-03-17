# AGENTS

`packages/domain` holds shared domain types and pure business-facing contracts.

## Tree

- `src/content.ts`: public content model types shared by data loaders and rendering code.
- `src/aliases.ts`: shared alias entry/admin row types.
- `src/admin.ts`: admin-facing DTO and bootstrap payload types.
- `src/search.ts`: search/suggestion type contracts.
- `src/characterAliases.ts`: character alias normalization and legacy JSON parsing helpers.
- `src/creatorAliases.ts`: creator-name normalization and alias parsing helpers.
- `src/keywordAliases.ts`: keyword normalization, splitting, and legacy JSON parsing helpers.
- `src/dateSearch.ts`: date query parsing and token generation helpers.
- `src/navigation.ts`: shared navigation item contracts.
- `src/commissionFileName.ts`: commission filename parsing helpers.
- `src/commissionSearchMetadata.ts`: shared search text / suggestion metadata builder.
- `src/timeline.ts`: timeline grouping and year-nav pure helpers.
- `src/index.ts`: single export surface for the package.

## Boundaries

- Keep this package runtime-light and app-agnostic.
- Put pure types and pure logic here; do not import from `apps/*`.
