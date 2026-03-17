# AGENTS

`packages` contains shared reusable modules.

## Tree

- `domain`: shared content/admin/search contracts and pure domain helpers.
- `ui`: shared React UI primitives that do not alter visual contracts.
- `cloudflare`: worker runtime types and helpers for D1/R2/auth.
- `config`: shared configuration presets.

## Dependency boundaries

- Packages must avoid depending on app-local files.
- `ui` must preserve existing design system semantics.
- `cloudflare` must stay runtime-agnostic to app layout concerns.
