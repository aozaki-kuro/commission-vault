# AGENTS

This directory contains admin-worker migration scripts.

## Tree

- `buildD1SeedSql.mjs`: reads the legacy SQLite truth from `apps/web/data/commissions.db` and generates deterministic seed SQL for D1.
- `checkFactSourceParity.mjs`: compares local SQLite/image truth with the remote D1/R2 state and reports mismatches.
- `exportWebFactSource.mjs`: exports the remote D1/R2 fact source into `apps/web/generated/*` so the public Astro build can stop reading local SQLite and `data/images/*`.
- `syncImagesToR2.mjs`: uploads source images from `apps/web/data/images/*` into the configured remote R2 bucket.

## Responsibilities

- Keep D1/R2 migration scripts deterministic and repeatable.
- Treat `apps/web/data/commissions.db` and `apps/web/data/images/*` as the current export source until publish cutover lands.
- Target the remote admin fact source directly; do not maintain a second worker-local fact source.
- Treat `apps/web/generated/*` as disposable build input, not committed source.

## Guardrails

- Do not mutate the source SQLite database or image directory.
- Keep temporary script outputs under `.wrangler/` when validating, and keep default public build inputs under gitignored `apps/web/generated/`.
- Preserve the current source-image key contract: object key equals the original source filename.
