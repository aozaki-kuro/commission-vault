# AGENTS

This directory contains the standalone admin worker.

## Tree

- `src/index.ts`: worker entrypoint for auth, local-dev CORS handling, asset serving, and delegation into the admin API router.
- `src/adminApi.ts`: admin API router that owns CRUD route matching, payload normalization, error envelopes, legacy passthrough allowlist, and the swappable CRUD backend adapter.
- `src/adminData.ts`: worker-owned read-side loader for bootstrap, aliases, suggestion, character-commission, and source-image GET routes when D1/R2 bindings exist.
- `src/adminWriteApi.ts`: worker-owned non-CRUD write-route shell for compatibility responses and conditional native-write routing (`DB` bound -> native, otherwise legacy fallback).
- `src/adminPersistence.ts`: worker-native D1 persistence helpers for admin non-CRUD writes (`aliases` + `suggestion`) with shared normalization rules.
- `src/adminApi.test.ts`: contract tests that lock CRUD route normalization and failure responses so standalone admin and worker do not drift apart.
- `migrations/0001_admin_fact_source.sql`: worker-owned D1 schema baseline for characters, commissions, aliases, and featured keyword state.
- `scripts/buildD1SeedSql.mjs`: deterministic SQLite -> D1 seed export for the current admin fact source.
- `scripts/syncImagesToR2.mjs`: local/remote image uploader that mirrors `apps/web/data/images/*` into the configured R2 bucket.
- `wrangler.jsonc`: worker asset binding, D1/R2 binding declarations, local legacy API bridge origin, and route metadata.

## Responsibilities

- Protect `admin.crystallize.cc` with edge auth.
- Serve admin API (`/api/admin/*`).
- Serve admin frontend assets from `apps/admin/dist`.
- Use the worker + D1/R2 surface as the primary path for all new admin capability work, and treat the legacy bridge only as migration rollback/compatibility.
- Own read-side bootstrap/aliases/suggestion/character-commission/source-image GET routes when D1/R2 bindings exist, and fall back cleanly when they do not.
- Own the CRUD route contract in the worker even while persistence is still being migrated.
- Own alias/suggestion D1 writes when `DB` bindings exist, and only fall back to the legacy bridge when those bindings are absent.
- Bridge only the still-unmigrated legacy endpoints during migration so standalone admin routes can move incrementally without changing API shape.
- Standalone admin now targets this worker + D1/R2 surface for all future capability work; the worker-backed routes are the primary path, and the legacy `/api/admin/*` in `apps/web` stays frozen as rollback/bridge only.

## Guardrails

- Keep admin API contract stable during migration.
- Keep auth at worker edge, not in client-side JavaScript.
- Avoid mixing public site routes into this worker.
- Keep cross-origin allowances limited to local development origins; production should stay same-origin behind the worker.
- Limit legacy write bridging to explicitly migrated routes; do not silently proxy the whole legacy API surface.

## Change Log

- 2026-03-17: Declared worker `DB` / `IMAGES` bindings, added `migrations/0001_admin_fact_source.sql`, and added local/remote bootstrap scripts for mirroring the current SQLite/image truth into D1/R2-shaped worker state.
- 2026-03-17: Added worker-native D1 persistence for character create/update/reorder/delete, and made the default CRUD backend prefer native character writes when `DB` bindings exist while leaving commission CRUD on legacy fallback.
- 2026-03-17: Added `src/adminData.ts` so worker read routes can serve bootstrap, aliases, suggestion, character-commission, and source-image GET requests when D1/R2 bindings exist, before falling back to legacy.
- 2026-03-17: Added worker-native D1 persistence for `aliases`/`suggestion` writes in `src/adminPersistence.ts`, and tightened write routing to native-with-DB plus legacy fallback when `DB` binding is absent.
- 2026-03-17: Split worker-owned non-CRUD write routes into `src/adminWriteApi.ts` and moved `assets/refresh` to a native compatibility no-op instead of legacy passthrough.
- 2026-03-17: Moved `create` / `edit` CRUD routes from raw whitelist proxying to native worker route handling with a swappable backend adapter, while leaving source-image / refresh / alias / suggestion flows on explicit passthrough.
- 2026-03-17: Added worker-side CRUD contract tests to lock request normalization and error response shape.
