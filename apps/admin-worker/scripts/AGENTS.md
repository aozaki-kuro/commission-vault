# admin-worker/scripts

## exportWebFactSource.ts

Exports remote D1/R2 fact source into `apps/web/generated/*`. Reuses generated images when D1 `source_images` metadata matches; re-downloads only on extension/hash drift or missing files.

- Target remote D1/R2 directly — no local SQLite/image bootstrap path
- `apps/web/generated/*` is disposable build input, not committed source
- Preserve source-image key contract: object key = original source filename
- Preserve `source_images` metadata contract: `commission_file_name`, `object_key`, `mime_type`, `byte_size`, `sha256`
