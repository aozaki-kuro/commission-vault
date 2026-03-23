# Commission Index

Don't look.

Personal use only

## Development

### Fresh machine setup

This repo uses Bun workspaces with a lightweight Turborepo task graph. Install dependencies once from the repository root; do not `bun install` inside each app separately.

1. Install runtime tools:
   - `mise install`
   - If Bun is not already available: `curl -fsSL https://bun.sh/install | bash`
2. Install workspace dependencies from the repo root:
   - `bun install`
3. Optional sanity checks:
   - `bun run lint`
   - `bun run check`
   - `bun run test`

Workspace notes:

- `apps/web`, `apps/admin`, `apps/admin-worker`, and `packages/domain` all resolve dependencies through the root workspace install.
- Root-only tooling such as ESLint, Prettier, Playwright, Vitest, and the root `better-tailwindcss` rule also comes from that same root install.
- `turbo.json` is intentionally minimal and currently only orchestrates cacheable workspace tasks such as `build`, `check`, and `typecheck`.
- Local Turborepo cache lives in `.turbo/`; GitHub Actions now restores that directory between runs alongside the generated source-image cache.
- If you add a dependency that is used by a root config file (for example `eslint.config.ts`), declare it in the root `package.json` even if app workspaces also use it.

- `bun run dev` — run the public `apps/web` Astro app in development mode.
- `bun run dev:admin` — start the standalone admin frontend plus `apps/admin-worker` in local `wrangler dev` mode with remote D1/R2 bindings enabled by config.
- `bun run dev:admin:remote` — compatibility alias for `bun run dev:admin`.
- `apps/web` no longer mounts the legacy `/admin` pages in local dev; use `bun run dev:admin` for admin work.
- Admin route shells are Astro pages; interactive admin state is mounted via React islands.
- `bun run build` — run Astro static build output to `apps/web/dist/`.
- `bun run build:all` — run every workspace `build` task that currently participates in the Turbo graph.
- `bun run typecheck` — run workspace `typecheck` tasks through Turbo.
- `bun run preview` — preview static output locally.

Monorepo migration is in progress:

- Public runtime source of truth is `apps/web/*`.
- New scaffolds are available at `apps/admin`, `apps/admin-worker`, and `apps/web`.
- New workspace scripts:
  - `bun run dev:web`
  - `bun run dev:admin`
  - `bun run dev:admin:remote`
  - `bun run dev:worker`
  - `bun run build:web`
  - `bun run build:admin`

## Admin migration direction

- Standalone admin capability work now lands on `apps/admin-worker` with `DB` / `IMAGES` bindings; future CRUD, asset writes, and admin tooling should target the worker + D1/R2 surface instead of expanding the legacy `/api/admin/*` layer inside `apps/web`.
- `bun run dev:admin` is now the default standalone admin workflow. It starts `apps/admin` plus `apps/admin-worker` in local `wrangler dev` mode against the configured remote D1/R2 resources, without pulling in `apps/web`.
- The admin worker no longer falls back to the legacy local SQLite/image path when `DB` or `IMAGES` bindings are missing. Known admin routes fail fast until the remote D1/R2-backed runtime is available.
- The legacy `/admin` pages together with `/api/admin/*` in `apps/web` are now reference-only code paths and are not mounted by default.
- `apps/admin-worker/wrangler.jsonc` now declares the real production `DB` / `IMAGES` bindings plus the D1 migrations directory, and the current remote D1/R2 fact source is the only supported admin/runtime truth.

## Cloudflare deploy layout

- Do not keep a repo-root `wrangler.jsonc` for deployment. Each Worker owns its own app-local config.
- Public site Worker config lives at `apps/web/wrangler.jsonc`.
- Admin Worker config lives at `apps/admin-worker/wrangler.jsonc`.
- `apps/web/wrangler.jsonc` also carries read-only `DB` / `IMAGES` bindings so the public-site build can export `generated/*` from remote D1/R2 before Astro builds static assets.
- Manual deploy entrypoints stay at the repo root:
  - `bun run deploy:web`
  - `bun run deploy:admin`
- Cloudflare Workers Builds must connect the same Git repo to two separate Workers with different root directories:
  - `commission-index-web`
    - Root directory: `apps/web`
    - Build command: `bun run build`
    - Deploy command: `bun run deploy`
  - `commission-index-admin`
    - Root directory: `apps/admin-worker`
    - Build command: `bun run build:assets`
    - Deploy command: `bun run deploy`
- Recommended watch paths:
  - Web: `apps/web/**`, `packages/**`, `apps/admin-worker/scripts/exportWebFactSource.ts`
  - Admin: `apps/admin-worker/**`, `apps/admin/**`, `packages/**`
- GitHub Actions now restores `.turbo/` and warms the Turbo graph with `bun run build:web` / `bun run build:admin` before the deploy steps. This keeps CI compatible with Bun workspaces while avoiding a heavier Nx-style setup.
- Workers Builds does not infer monorepo intent from the repo root. Push-triggered builds are recognized from the Worker's Dashboard settings plus the `wrangler.jsonc` that lives under that worker's root directory.
- `apps/web` build does not talk to D1/R2 directly at runtime. It shells into `apps/admin-worker/scripts/exportWebFactSource.ts`, but that export is now explicitly driven by `apps/web/wrangler.jsonc` during web builds so the web Worker project owns the bindings needed for push-triggered exports.

## Tests

- `bun run test` — run the full Vitest suite.
- `bun run test:watch` — watch tests during local development.
- `bun run test:changed` — run changed tests only.

Asset generation is shared by Astro:

- Home update summary is computed during page rendering.
- `/search/home-search-entries.json` is served by an Astro route at request/build time.
- `/rss.xml` is served by an Astro route at request/build time.
- Source images are imported from `apps/web/generated/source-images/*`; in dev, generated fact-source/image changes trigger a full page reload automatically.

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
