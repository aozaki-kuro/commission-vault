# AGENTS

This directory contains the standalone admin frontend app (`Vite + React`).

## Tree

- `index.html`: admin root document metadata and shell mount point.
- `public/favicon.svg`: standalone admin favicon while the app is served from `admin.crystallize.cc`.
- `public/fonts/BerkeleyMono-Regular.woff2`: admin-local Berkeley Mono asset so standalone builds do not depend on `apps/web` static paths.
- `src/App.tsx`: path-based page selection for the standalone admin shell.
- `src/main.tsx`: React entrypoint, IBM Plex Sans fontsource imports, and global style bootstrap.
- `src/app/sections.ts`: route definitions, titles, and shared page metadata.
- `src/app/ui.ts`: shared Tailwind class contracts for admin shell surfaces, form controls, and status badges.
- `src/components/AdminSuggestionDashboard.tsx`: migrated standalone suggestion dashboard with the existing drag/drop and save interactions intact.
- `src/components/AdminAliasesDashboard.tsx`: migrated standalone aliases dashboard with legacy tab layout and batch-save forms intact.
- `src/components/AdminLayout.tsx`: top-level layout and page header/nav wrapper.
- `src/components/AdminSectionNav.tsx`: section navigation for overview/create/edit/aliases/suggestion.
- `src/components/FormStatusIndicator.tsx`: shared save/error feedback indicator for standalone admin forms.
- `src/lib/adminActions.ts`: worker-backed form actions for standalone admin writes.
- `src/lib/adminApi.ts`: worker API URL resolution, retrying JSON fetch, and overview/suggestion bootstrap helpers.
- `src/lib/formState.ts`: shared form status types for standalone admin actions.
- `src/lib/keywords.ts`: keyword normalization/deduplication helpers reused by suggestion UI.
- `src/pages/AdminAliasesPage.tsx`: standalone aliases route that loads alias bootstrap data through the worker bridge.
- `src/pages/AdminOverviewPage.tsx`: standalone overview route that loads real admin counts and latest entries through the worker bridge.
- `src/pages/AdminSuggestionPage.tsx`: standalone suggestion route that loads and saves featured keywords through the worker bridge.
- `src/pages/AdminPlaceholderPage.tsx`: per-route placeholder panels until the real pages are ported.
- `src/styles/globals.css`: migrated global Tailwind/base styles plus the standalone admin font-family contract.
- `test/visual/helpers.ts`: shared Playwright helpers for stable admin screenshots and project gating.
- `test/visual/admin-legacy-reference.spec.ts`: legacy `/admin/*` screenshot source-of-truth suite that captures reference baselines from `apps/web`.
- `test/visual/admin-suggestion.spec.ts`: standalone admin Playwright visual regression for the suggestion page.
- `src/vite-env.d.ts`: client env typing for `ADMIN_API_BASE_URL`.
- `vite.config.ts`: Vite config with Tailwind v4 integration.

## Responsibilities

- Preserve the existing admin visual design, spacing rhythm, and typography.
- Reuse existing admin React components and interaction behavior without restyling.
- Talk only to the admin worker API via `ADMIN_API_BASE_URL`.
- Keep overview, suggestion, and aliases on the worker-backed data path; new route migrations should follow the same API boundary instead of reading legacy app internals directly.
- Use `admin-legacy` Playwright baselines as the migration reference until each standalone route fully matches legacy output.

## Guardrails

- Do not redesign admin UI during migration.
- Keep top-level style contracts aligned with the legacy admin shell.
- Validate every migrated admin page with Playwright visual regression.
- Keep route paths rooted at `/` on `admin.crystallize.cc`; do not reintroduce the old `/admin/*` public-site coupling.
