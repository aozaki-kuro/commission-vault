# AGENTS

`apps` contains deployable applications.

## Tree

- `web`: public static site deployment target.
- `admin`: standalone admin frontend (`Vite + React`).
- `admin-worker`: admin API + auth + asset serving worker.

## Dependency boundaries

- `web` depends on shared domain/build logic from `packages/*`.
- `admin` depends on shared domain/ui packages and calls `admin-worker`.
- `admin-worker` depends on shared `domain` code today and is wired to the real D1/R2-backed admin runtime; standalone admin development now targets that worker surface directly.
