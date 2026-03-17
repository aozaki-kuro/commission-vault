# AGENTS

This directory contains the standalone admin worker.

## Tree

- `src/index.ts`: worker entrypoint for auth, local-dev CORS handling, asset serving, and delegation into the admin API router.
- `src/adminApi.ts`: admin API router that owns CRUD route matching, payload normalization, error envelopes, legacy passthrough allowlist, and the swappable CRUD backend adapter.
- `src/adminApi.test.ts`: contract tests that lock CRUD route normalization and failure responses so standalone admin and worker do not drift apart.
- `wrangler.jsonc`: worker asset binding, local legacy API bridge origin, and route metadata.

## Responsibilities

- Protect `admin.crystallize.cc` with edge auth.
- Serve admin API (`/api/admin/*`).
- Serve admin frontend assets from `apps/admin/dist`.
- Access D1 and R2 through Worker bindings.
- Own the CRUD route contract in the worker even while persistence is still being migrated.
- Bridge only the still-unmigrated legacy endpoints during migration so standalone admin routes can move incrementally without changing API shape.

## Guardrails

- Keep admin API contract stable during migration.
- Keep auth at worker edge, not in client-side JavaScript.
- Avoid mixing public site routes into this worker.
- Keep cross-origin allowances limited to local development origins; production should stay same-origin behind the worker.
- Limit legacy write bridging to explicitly migrated routes; do not silently proxy the whole legacy API surface.

## Change Log

- 2026-03-17: Moved `create` / `edit` CRUD routes from raw whitelist proxying to native worker route handling with a swappable backend adapter, while leaving source-image / refresh / alias / suggestion flows on explicit passthrough.
- 2026-03-17: Added worker-side CRUD contract tests to lock request normalization and error response shape.
