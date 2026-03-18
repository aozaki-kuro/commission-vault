# AGENTS

`apps/web` is the active Astro 6 public runtime.

## Tree

- `astro.config.ts`: Astro app config and dev integrations.
- `package.json`: web app scripts (`dev/build/check/deploy`) plus wrappers that delegate shared test commands back to the repo root.
- `tsconfig.json`: web-local alias and TypeScript config.
- `wrangler.jsonc`: public site deployment config for `crystallize.cc`.
- `src/`: Astro pages, islands, i18n, home logic, and legacy admin reference code.
- `src/config/`: site metadata and workspace-local runtime shims such as the React server renderer bridge.
- `server/`: Astro dev integrations and admin API handler bridge.
- `data/`: generated fact-source loader plus public-site data access modules.
- `generated/`: ignored build inputs materialized from remote D1/R2 (`fact-source/*.json` + `source-images/*`) before `dev/build/check`.
- `public/`: static assets and redirects/headers.
- `test/`: web-owned Vitest setup/helpers and Playwright spec files; shared test config, visual baselines, and generated results now live at the repo root.

## Responsibilities

- Render public site as static output from Astro.
- Do not mount or extend legacy `/admin*` behavior in `apps/web`; standalone admin lives in `apps/admin`.
- Preserve existing home/search/nav DOM contracts while migrating infra.
- Treat `generated/*` as the only public-site fact source; do not reintroduce SQLite or `data/images/*` reads into the build path.

## Dependency Boundaries

- `apps/web` may import from `packages/*`, but must not import source files from `apps/admin` or `apps/admin-worker`.
- Admin React frontend migration target remains `apps/admin`; do not add new production admin features into this app.
- Worker runtime migration target remains `apps/admin-worker`; web output stays static-first.
- Remote D1/R2 access belongs to `apps/admin-worker/scripts/exportWebFactSource.ts`; `apps/web` only consumes the generated snapshot it writes.
