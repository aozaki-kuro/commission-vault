# AGENTS

This directory contains admin-worker migration scripts.

## Tree

- `buildD1SeedSql.mjs`: reads the legacy SQLite truth from `apps/web/data/commissions.db` and generates deterministic seed SQL for D1.
- `checkFactSourceParity.mjs`: compares local SQLite/image truth with worker-local or remote D1/R2 state and reports mismatches.
- `syncImagesToR2.mjs`: uploads source images from `apps/web/data/images/*` into the configured R2 bucket for local or remote worker testing.

## Responsibilities

- Keep D1/R2 migration scripts deterministic and repeatable.
- Treat `apps/web/data/commissions.db` and `apps/web/data/images/*` as the current export source until publish cutover lands.
- Prefer explicit local/remote flags over hidden environment magic.

## Guardrails

- Do not mutate the source SQLite database or image directory.
- Keep generated artifacts under `.wrangler/` so they stay untracked.
- Preserve the current source-image key contract: object key equals the original source filename.
