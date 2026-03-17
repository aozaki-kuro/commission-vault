# Commission Index

Don't look.

Personal use only

## Development

- `bun run dev` — run `apps/web` Astro app in development mode (`/api/admin/*` handled inside Astro dev middleware).
- Admin pages (`/admin`, `/admin/aliases`) are injected only in development and are not part of production build output.
- Admin route shells are Astro pages; interactive admin state is mounted via React islands.
- `bun run build` — run Astro static build output to `apps/web/dist/`.
- `bun run preview` — preview static output locally.
- Admin page includes a dev-only floating `Refresh Assets Cache` button to force a fresh admin bootstrap fetch.

Monorepo migration is in progress:

- Public runtime source of truth is `apps/web/*`.
- New scaffolds are available at `apps/admin`, `apps/admin-worker`, and `apps/web`.
- New workspace scripts:
  - `bun run dev:web`
  - `bun run dev:admin`
  - `bun run dev:worker`
  - `bun run build:web`
  - `bun run build:admin`
  - `bun run admin:data:bootstrap:local`
  - `bun run admin:data:bootstrap:remote`

## Admin migration direction

- Standalone admin capability work now lands on `apps/admin-worker` with `DB` / `IMAGES` bindings and D1/R2 migration scripts; future CRUD, asset writes, and admin tooling should target the worker + D1/R2 surface instead of expanding the legacy `/api/admin/*` layer inside `apps/web`.
- The legacy `/admin` pages together with `/api/admin/*` in `apps/web` are preserved strictly as migration rollback/bridge paths. They may remain temporarily for fallback, but they are no longer the place to add new admin behavior.
- To initialize the current local SQLite/images truth into worker-local D1/R2 state, run `bun run admin:data:bootstrap:local`.
- `apps/admin-worker/wrangler.jsonc` now declares `DB` / `IMAGES` bindings plus the D1 migrations directory. Preview/production resource IDs and the final remote runbook remain follow-up work.

## Tests

- `bun run test` — run the full Vitest suite.
- `bun run test:watch` — watch tests during local development.
- `bun run test:changed` — run changed tests only.

Asset generation is shared by Astro:

- Home update summary is computed during page rendering.
- `/search/home-search-entries.json` is served by an Astro route at request/build time.
- `/rss.xml` is served by an Astro route at request/build time.
- Source images under `apps/web/data/images` are imported by Astro Image at runtime; in dev, image add/change/remove triggers a full page reload automatically.

### Dev ports

- `apps/web` Astro dev defaults to `4321`.
- `apps/admin-worker` Wrangler dev defaults to `8787`.
- `apps/admin` Vite dev runs on `4174`.
- `PORT` still overrides the Astro dev port when you need a different `apps/web` port.

### Production `/admin` verification

- Production deployment is static-only (no Worker entrypoint).
- `/admin` and `/api/admin/*` return 404 from static `assets.not_found_handling = "404-page"`.
- `/admin` and `/api/admin/*` are explicitly mapped to `404` in `apps/web/public/_redirects`.
- `vite preview` does not validate edge HTTP status behavior for static host routing.
- Verify using deployed Cloudflare URL:

```bash
curl -I https://<your-domain>/admin
curl -I https://<your-domain>/admin/aliases
curl -I https://<your-domain>/api/admin/bootstrap
```

- Expected result: all above endpoints return `404`.
