# apps

Deployable applications. See root AGENTS.md for workspace layout.

## Dependency Boundaries

- `web` depends on `packages/*` only
- `admin` calls `admin-worker` for all data operations
- `admin-worker` depends on `packages/domain` and owns the D1/R2 runtime
