# AGENTS

This directory contains admin-worker export scripts.

## Tree

- `exportWebFactSource.ts`: exports the remote D1/R2 fact source into `apps/web/generated/*`, reuses generated images when D1 `source_images` metadata still matches, and re-downloads only on extension/hash drift or missing files.

## Responsibilities

- Keep remote fact-source export deterministic and repeatable.
- Target the remote admin fact source directly; do not recreate a local SQLite/image bootstrap path.
- Treat `apps/web/generated/*` as disposable build input, not committed source.

## Guardrails

- Keep temporary script outputs under `.wrangler/` when validating, and keep default public build inputs under gitignored `apps/web/generated/`.
- Preserve the current source-image key contract: object key equals the original source filename.
- Preserve the `source_images` metadata contract: `commission_file_name`, `object_key`, `mime_type`, `byte_size`, and `sha256` must stay aligned with the remote R2 object so incremental reuse decisions remain correct.
