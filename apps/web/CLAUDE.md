# web

Active Astro 6 public runtime (`crystallize.cc`).

## Key Files

- `astro.config.ts` — Astro config + dev integrations
- `wrangler.jsonc` — public-site Worker config; must retain read-only `DB`/`IMAGES` bindings for build-time fact-source export
- `src/config/` — site metadata and React server renderer shim
- `server/` — Astro dev integrations, admin API handler bridge
- `data/` — generated fact-source loader, public-site data access
- `generated/` — gitignored build inputs from remote D1/R2 (fact-source JSON + source images)

## Responsibilities

- Render static output from Astro; no runtime D1/R2 access
- Treat `generated/*` as the only fact source — no SQLite or `data/images/*` reads
- Do not mount legacy `/admin*` behavior; standalone admin lives in `apps/admin`

## Dependency Boundaries

- May import from `packages/*` only — never from `apps/admin` or `apps/admin-worker`
- Remote D1/R2 access belongs to `exportWebFactSource.ts`; web only consumes the generated snapshot
- Web-owned builds drive export through `apps/web/wrangler.jsonc`, not admin-worker's config
