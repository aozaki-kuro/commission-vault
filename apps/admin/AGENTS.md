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
- `src/components/AdminAliasesDashboard.tsx`: migrated standalone aliases dashboard with legacy tab layout and batch-save forms intact.
- `src/components/AdminCreateDashboard.tsx`: standalone create dashboard that mounts the migrated add-character and add-commission forms.
- `src/components/AdminEditDashboard.tsx`: standalone edit dashboard that mounts the migrated commission manager and floating refresh affordance.
- `src/components/AdminLayout.tsx`: top-level layout and page header/nav wrapper.
- `src/components/AdminSectionNav.tsx`: section navigation for overview/create/edit/aliases/suggestion.
- `src/components/AdminSuggestionDashboard.tsx`: migrated standalone suggestion dashboard with the existing drag/drop and save interactions intact.
- `src/components/FormStatusIndicator.tsx`: shared save/error feedback indicator for standalone admin forms.
- `src/components/SubmitButton.tsx`: shared pending-aware submit button for standalone admin forms.
- `src/components/create/AddCharacterForm.tsx`: migrated create form for new character records.
- `src/components/create/AddCommissionForm.tsx`: migrated create form for new commission records, including source-image upload and duplicate hints.
- `src/components/create/CommissionFormFields.tsx`: shared create-form field primitives and hidden toggle.
- `src/components/create/CommissionSharedFields.tsx`: shared commission metadata field composition.
- `src/components/create/DuplicateCommissionNotice.tsx`: non-blocking duplicate hint panel for new commissions.
- `src/components/edit/CharacterDeleteDialog.tsx`: standalone confirmation dialog for destructive character deletion.
- `src/components/edit/CommissionEditForm.tsx`: migrated edit form for existing commissions, including source-image replacement and delete flow.
- `src/components/edit/CommissionManager.tsx`: migrated edit-page orchestration for search, lazy commission loading, drag ordering, and character disclosure state.
- `src/components/edit/SortableCharacterCard.tsx`: editable draggable character card and commission panel shell for the edit page.
- `src/components/edit/SortableDivider.tsx`: draggable active/stale divider for edit-page ordering.
- `src/hooks/useCommissionEditState.ts`: local controlled-form state for existing commission editing and image preview URLs.
- `src/hooks/useCommissionManager.ts`: edit-page reducer graph for disclosure, drag ordering, rename, and delete orchestration.
- `src/lib/adminActions.ts`: worker-backed form actions for standalone admin writes.
- `src/lib/adminApi.ts`: worker API URL resolution, retrying JSON fetch, and overview/suggestion/bootstrap helpers.
- `src/lib/commissionFileName.ts`: standalone file-name validation used by create forms.
- `src/lib/dataUpdateSignal.ts`: cross-tab/update broadcast for reloading create/edit bootstrap data after writes.
- `src/lib/duplicateCommissionHints.ts`: duplicate-detection scoring for create/edit commission forms.
- `src/lib/formState.ts`: shared form status types for standalone admin actions.
- `src/lib/keywords.ts`: keyword normalization/deduplication helpers reused by suggestion UI.
- `src/lib/search/adminCommissionSearch.ts`: standalone edit-page search-text assembly and matched commission/character resolution.
- `src/pages/AdminAliasesPage.tsx`: standalone aliases route that loads alias bootstrap data through the worker bridge.
- `src/pages/AdminCreatePage.tsx`: standalone create route that loads bootstrap data and renders the migrated create dashboard.
- `src/pages/AdminEditPage.tsx`: standalone edit route that loads bootstrap data, restores scroll on reload, and exposes refresh-assets feedback.
- `src/pages/AdminOverviewPage.tsx`: standalone overview route that loads real admin counts and latest entries through the worker bridge.
- `src/pages/AdminPlaceholderPage.tsx`: per-route placeholder panels until the real pages are ported.
- `src/pages/AdminSuggestionPage.tsx`: standalone suggestion route that loads and saves featured keywords through the worker bridge.
- `src/styles/globals.css`: migrated global Tailwind/base styles plus the standalone admin font-family contract.
- `src/vite-env.d.ts`: client env typing for `ADMIN_API_BASE_URL`.
- `test/visual/admin-create.spec.ts`: standalone admin Playwright visual regression for the create page and its form cluster.
- `test/visual/admin-edit.spec.ts`: standalone admin Playwright visual regression for the edit page shell and commission manager.
- `test/visual/admin-legacy-reference.spec.ts`: legacy `/admin/*` screenshot source-of-truth suite that captures reference baselines from `apps/web`.
- `test/visual/admin-suggestion.spec.ts`: standalone admin Playwright visual regression for the suggestion page.
- `test/visual/helpers.ts`: shared Playwright helpers for stable admin screenshots and project gating.
- `vite.config.ts`: Vite config with Tailwind v4 integration.

## Responsibilities

- Preserve the existing admin visual design, spacing rhythm, and typography.
- Reuse existing admin React components and interaction behavior without restyling.
- Where legacy admin uses shadcn/Radix primitives such as `Select` or dropdown-style overlays, preserve those primitives and behaviors in standalone admin instead of downgrading to native `<select>` or approximate custom controls.
- Talk only to the admin worker API via `ADMIN_API_BASE_URL`.
- Keep overview, create, edit, suggestion, and aliases on the worker-backed data path; new route migrations should follow the same API boundary instead of reading legacy app internals directly.
- Use `admin-legacy` Playwright baselines as the migration reference until each standalone route fully matches legacy output.

## Guardrails

- Do not redesign admin UI during migration.
- Keep top-level style contracts aligned with the legacy admin shell.
- Treat route existence and rough layout parity as insufficient; migration is not done until spacing, states, and legacy control choices are matched route-by-route.
- Validate every migrated admin page with Playwright visual regression.
- Keep route paths rooted at `/` on `admin.crystallize.cc`; do not reintroduce the old `/admin/*` public-site coupling.

## Change Log

- 2026-03-17: Migrated the standalone `create` route, moved add-character/add-commission form logic into `apps/admin`, and bridged create writes through the admin worker.
- 2026-03-17: Migrated the standalone `edit` route, moved `CommissionManager` and edit form logic into `apps/admin`, and extended the admin worker bridge for edit CRUD/source-image/refresh flows.
