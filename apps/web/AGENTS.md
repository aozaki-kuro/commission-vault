# AGENTS

`apps/web` is the active Astro 6 public runtime.

## Tree

- `astro.config.ts`: Astro app config and dev integrations.
- `package.json`: web app scripts (`dev/build/check/test/visual/deploy`).
- `tsconfig.json`: web-local alias and TypeScript config.
- `wrangler.jsonc`: public site deployment config for `crystallize.cc`.
- `src/`: Astro pages, islands, i18n, home/admin-dev UI logic.
- `src/config/`: site metadata and workspace-local runtime shims such as the React server renderer bridge.
- `server/`: Astro dev integrations and admin API handler bridge.
- `data/`: SQLite data source and data access modules.
- `public/`: static assets and redirects/headers.
- `test/`: Vitest and Playwright test suites.

## Responsibilities

- Render public site as static output from Astro.
- Keep `/admin*` writable behavior dev-only (`NODE_ENV=development`).
- Preserve existing home/search/nav DOM contracts while migrating infra.

## Dependency Boundaries

- `apps/web` may import from `packages/*`, but must not import source files from `apps/admin` or `apps/admin-worker`.
- Admin React frontend migration target remains `apps/admin`; do not add new production admin features into this app.
- Worker runtime migration target remains `apps/admin-worker`; web output stays static-first.
