# AGENTS

`apps` contains deployable applications.

## Tree

- `web`: public static site deployment target.
- `admin`: standalone admin frontend (`Vite + React`).
- `admin-worker`: admin API + auth + asset serving worker.

## Dependency boundaries

- `web` depends on shared domain/build logic from `packages/*`.
- `admin` depends on shared domain/ui packages and calls `admin-worker`.
- `admin-worker` depends on shared `domain` code today; `cloudflare` types and D1/R2 bindings are still migration scaffolds, not a fully wired runtime dependency yet.
