# AGENTS

This directory contains the standalone admin worker.

## Tree

- `src/index.ts`: worker entrypoint for auth, API routing, legacy read-bridge, and local-dev CORS handling.
- `wrangler.jsonc`: worker asset binding, local legacy API bridge origin, and route metadata.

## Responsibilities

- Protect `admin.crystallize.cc` with edge auth.
- Serve admin API (`/api/admin/*`).
- Serve admin frontend assets from `apps/admin/dist`.
- Access D1 and R2 through Worker bindings.
- Bridge selected legacy read endpoints during migration so standalone admin routes can move incrementally.

## Guardrails

- Keep admin API contract stable during migration.
- Keep auth at worker edge, not in client-side JavaScript.
- Avoid mixing public site routes into this worker.
- Keep cross-origin allowances limited to local development origins; production should stay same-origin behind the worker.
