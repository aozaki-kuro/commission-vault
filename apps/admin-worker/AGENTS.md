# AGENTS

This directory contains the standalone admin worker.

## Tree

- `src/index.ts`: worker entrypoint for local-dev CORS handling, asset serving, and delegation into the admin API router.
- `src/adminApi.ts`: admin API router that owns CRUD route matching, payload normalization, error envelopes, and binding-enforced D1/R2 execution for admin routes.
- `src/adminData.ts`: worker-owned read-side loader for bootstrap, aliases, suggestion, character-commission, and source-image GET routes on the D1/R2 admin fact source.
- `src/adminSourceImages.ts`: worker-owned R2 source-image validation and write helpers shared by commission create and source-image replace flows.
- `src/adminWriteApi.ts`: worker-owned non-CRUD write-route shell for compatibility responses and binding-enforced D1 writes.
- `src/adminPersistence.ts`: worker-native D1 persistence helpers for character CRUD, commission CRUD, aliases, suggestion, commission file-name lookup, and `source_images` metadata.
- `src/adminApi.test.ts`: contract tests that lock CRUD route normalization and failure responses so standalone admin and worker do not drift apart.
- `migrations/0001_admin_fact_source.sql`: worker-owned D1 schema baseline for characters, commissions, aliases, and featured keyword state.
- `migrations/0002_source_image_metadata.sql`: D1 source-image metadata table for extension/hash/size-based export reuse.
- `scripts/exportWebFactSource.ts`: remote D1/R2 -> `apps/web/generated/*` export for the public-site build inputs.
- `wrangler.jsonc`: worker asset binding, D1/R2 binding declarations, and route metadata.

## Responsibilities

- Serve `admin.crystallize.cc` directly and treat Cloudflare Zero Trust as the production auth boundary.
- Serve admin API (`/api/admin/*`).
- Serve admin frontend assets from `apps/admin/dist`.
- Use the worker + D1/R2 surface as the only active admin runtime for standalone development.
- Own read-side bootstrap/aliases/suggestion/character-commission/source-image GET routes directly on D1/R2.
- Own character CRUD, commission CRUD, source-image replacement, alias writes, and suggestion writes directly on D1/R2.
- Keep `source_images` metadata in D1 aligned with R2 objects so web fact-source export can reuse generated images incrementally.
- Fail fast when `DB` or `IMAGES` bindings are missing from known admin routes; do not silently proxy writes back into `apps/web`.
- Keep the standalone admin dev loop aligned with deployment topology by defaulting to `bun run dev:admin` / local `wrangler dev` with remote bindings, not `apps/web`.
- Treat the legacy `/api/admin/*` code in `apps/web` as rollback/reference only, not as part of the default runtime path.

## Guardrails

- Keep admin API contract stable during migration.
- Do not reintroduce worker-side password prompts; production access control belongs in Cloudflare Zero Trust, not in the worker bundle.
- Avoid mixing public site routes into this worker.
- Keep cross-origin allowances limited to local development origins; production should stay same-origin behind the worker.
- Do not reintroduce runtime fallback from worker routes back into `apps/web`.

## Change Log

- 2026-03-17: Switched the default admin dev entrypoint to `bun run dev:admin`, removed worker-side runtime fallback to the legacy admin API, and made known admin routes fail fast when `DB` / `IMAGES` bindings are missing.
- 2026-03-17: Added `src/adminSourceImages.ts`, moved commission create/update/delete plus `POST /api/admin/commissions/:id/source-image` onto worker-native D1/R2 execution when bindings exist, and extended CRUD contract tests to cover rollback and source-image replacement semantics.
- 2026-03-17: Added root `scripts/devAdminRemote.ts` together with `bun run dev:admin` / `bun run dev:admin:remote`, so standalone admin development defaults to `apps/admin` + `apps/admin-worker` with remote bindings instead of pulling in `apps/web`.
- 2026-03-17: Declared worker `DB` / `IMAGES` bindings, added `migrations/0001_admin_fact_source.sql`, and added remote bootstrap scripts for mirroring the current SQLite/image truth into the D1/R2 fact source.
- 2026-03-17: Added worker-native D1 persistence for character create/update/reorder/delete, and made the default CRUD backend prefer native character writes when `DB` bindings exist.
- 2026-03-17: Added `src/adminData.ts` so worker read routes can serve bootstrap, aliases, suggestion, character-commission, and source-image GET requests when D1/R2 bindings exist, before falling back to legacy.
- 2026-03-17: Added worker-native D1 persistence for `aliases`/`suggestion` writes in `src/adminPersistence.ts`, and tightened write routing to native-with-DB plus legacy fallback when `DB` binding is absent.
- 2026-03-17: Split worker-owned non-CRUD write routes into `src/adminWriteApi.ts` and moved `assets/refresh` to a native compatibility no-op instead of legacy passthrough.
- 2026-03-17: Moved `create` / `edit` CRUD routes from raw whitelist proxying to native worker route handling with a swappable backend adapter.
- 2026-03-17: Added worker-side CRUD contract tests to lock request normalization and error response shape.
- 2026-03-18: Added `scripts/exportWebFactSource.ts` so the public Astro build can materialize generated fact-source inputs from remote D1/R2 instead of continuing to rely on local SQLite and `data/images/*`.
- 2026-03-18: Added `migrations/0002_source_image_metadata.sql`, made worker writes persist `source_images` metadata, and taught export to reuse generated images by D1 extension/hash metadata instead of bulk re-downloading.
- 2026-03-18: Removed worker-side Basic Auth and `ADMIN_REALM`; production admin auth is now expected to be enforced by Cloudflare Zero Trust in front of `admin.crystallize.cc`.
