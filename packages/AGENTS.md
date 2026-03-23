# AGENTS

`packages` contains shared reusable modules.

## Tree

- `domain`: shared content/admin/search contracts and pure domain helpers.
- `ui`: shared React UI primitives that do not alter visual contracts.
- `cloudflare`: placeholder worker env/types for future D1/R2/auth sharing; it is not in the main runtime path yet.
- `config`: shared configuration presets.

## Dependency boundaries

- Packages must avoid depending on app-local files.
- `ui` must preserve existing design system semantics.
- `cloudflare` must stay runtime-agnostic to app layout concerns.
