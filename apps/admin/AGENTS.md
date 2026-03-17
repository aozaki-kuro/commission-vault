# AGENTS

This directory contains the standalone admin frontend app (`Vite + React`).

## Tree

- `index.html`: admin root document metadata and shell mount point.
- `public/favicon.svg`: standalone admin favicon while the app is served from `admin.crystallize.cc`.
- `src/App.tsx`: path-based page selection for the standalone admin shell.
- `src/main.tsx`: React entrypoint and global style bootstrap.
- `src/app/sections.ts`: route definitions, titles, and shared page metadata.
- `src/app/ui.ts`: shared Tailwind class contracts for admin shell surfaces and status badges.
- `src/components/AdminLayout.tsx`: top-level layout and page header/nav wrapper.
- `src/components/AdminSectionNav.tsx`: section navigation for overview/create/edit/aliases/suggestion.
- `src/lib/adminApi.ts`: worker API URL resolution, retrying JSON fetch, and overview bootstrap helpers.
- `src/pages/AdminOverviewPage.tsx`: standalone overview route that loads real admin counts and latest entries through the worker bridge.
- `src/pages/AdminPlaceholderPage.tsx`: per-route placeholder panels until the real pages are ported.
- `src/styles/globals.css`: migrated global Tailwind/base styles from the legacy admin shell.
- `src/vite-env.d.ts`: client env typing for `ADMIN_API_BASE_URL`.
- `vite.config.ts`: Vite config with Tailwind v4 integration.

## Responsibilities

- Preserve the existing admin visual design, spacing rhythm, and typography.
- Reuse existing admin React components and interaction behavior without restyling.
- Talk only to the admin worker API via `ADMIN_API_BASE_URL`.
- Keep overview as the first real standalone route; new route migrations should follow the same worker-backed data path instead of reading legacy app internals directly.

## Guardrails

- Do not redesign admin UI during migration.
- Keep top-level style contracts aligned with the legacy admin shell.
- Validate every migrated admin page with Playwright visual regression.
- Keep route paths rooted at `/` on `admin.crystallize.cc`; do not reintroduce the old `/admin/*` public-site coupling.
