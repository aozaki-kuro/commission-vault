# AGENTS

This directory contains the standalone admin worker.

## Responsibilities

- Protect `admin.crystallize.cc` with edge auth.
- Serve admin API (`/api/admin/*`).
- Serve admin frontend assets from `apps/admin/dist`.
- Access D1 and R2 through Worker bindings.

## Guardrails

- Keep admin API contract stable during migration.
- Keep auth at worker edge, not in client-side JavaScript.
- Avoid mixing public site routes into this worker.
