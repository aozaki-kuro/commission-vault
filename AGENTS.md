# AGENTS

This repository contains an Astro 6 static site with React 19 islands, written in TypeScript and managed with Bun.

## Development Notes

- **Runtime & package manager:** Node 24 via [mise](https://mise.jdx.dev) and `bun` for all commands.
- **Task graph & cache:** root workspace task orchestration now uses `turbo.json` for cacheable `build` / `check` / `typecheck` tasks; keep the graph lightweight and do not move deploy/runtime ownership into Turbo.
- **Framework:** Astro + Tailwind CSS + selective React islands (`@astrojs/react`).
- **Repo-level testing:** `vitest.config.ts` and `playwright.config.ts` live at the repository root so `bun run test*` exercises the workspace from one entrypoint; keep app-owned test suites under each workspace, keep committed Playwright baselines under root `test/visual/apps/<workspace>/`, and keep generated outputs under root `coverage/`, `test-results/`, and `playwright-report/`.
- **Astro 6 guardrails:**
  - Keep `i18n.routing.redirectToDefaultLocale` explicit whenever `/` is a real page and must not silently inherit future default changes.
  - Keep `apps/web/src/content.config.ts` present even when empty. It exists to satisfy Astro's content bootstrap and suppress the dev-only `Content config not loaded` warning; do not add collections unless the project actually adopts them.
  - If the project ever adopts Astro content collections, use the Content Layer API only: `apps/web/src/content.config.ts` + `astro/loaders` + `astro/zod`. Do not introduce legacy collections.
  - Do not enable Astro CSP casually. In the current stack it still carries validation friction (`dev` cannot verify it, and Shiki inline styles conflict with it). If you revisit it later, use `security.csp` and remember that analytics needs `https://sight.crystallize.cc` on the script allowlist.
- **Path aliases:** Prefer `#layouts/*`, `#features/*`, `#components/*`, `#images/*`, `#data/*`, `#lib/*`, `#styles/*`, `#config/*`, and `#admin/*` (`#admin/actions` points to the HTTP client action wrappers).
- **Data source:** Public-site build input lives under `apps/web/generated/*` and is exported from the remote D1/R2 fact source by `apps/admin-worker/scripts/exportWebFactSource.ts`.
  - Admin-managed search configuration tables live in remote D1 (`character_aliases`, `creator_aliases`, `keyword_aliases`, `home_featured_search_keywords`), and source-image metadata lives in remote D1 `source_images`.
- **Web build bindings:** `apps/web/wrangler.jsonc` must keep read-only `DB` / `IMAGES` bindings aligned with `apps/admin-worker/wrangler.jsonc` so push-triggered web builds can export fresh generated fact-source inputs before Astro runs.
- **Cloudflare deploy commands:** manual repo-level deploy entrypoints are `bun run deploy:web` and `bun run deploy:admin`, which delegate into each workspace-local `wrangler.jsonc`. Do not restore a repo-root `wrangler.jsonc`; Cloudflare Workers Builds must connect the same repo to two Workers with root directories `apps/web` and `apps/admin-worker`, because push-triggered builds are resolved from Dashboard root/build/deploy settings, not from a shared repo-root config.
- **GitHub Actions cache:** CI restores `.turbo/` plus `apps/web/generated/source-images` so Turbo can reuse local task outputs while the existing generated-image reuse path stays intact.
- **Deploy workflow rule:** repo-level deploy/rebuild workflows should not pre-run `web:fact-source:export`, `build:web`, or `build:admin` before `wrangler deploy`. The workspace-local `wrangler.jsonc` custom build commands already own those steps; duplicating them only wastes CI time.
- **CI layering:** `.github/workflows/ci.yml` is the default verification workflow. Keep base repo validation (`lint` / `test` / `typecheck` / `build:admin`) independent from Cloudflare secrets, and keep web `check/build` behind an explicit fact-source export step that only runs when remote credentials are available.
- **Web validation floor:** `apps/web` must keep a workspace-local `typecheck` script so root `turbo run typecheck` always covers the web package even when Cloudflare-backed Astro validation is skipped.
- **Workflow observability:** GitHub Actions workflows should emit step durations and cache-hit state into `GITHUB_STEP_SUMMARY` whenever cache strategy is under review; measure first, then decide whether to add remote cache or more cache layers.
- **Admin auth boundary:** `apps/admin-worker` no longer implements worker-side Basic Auth; production access to `admin.crystallize.cc` is expected to be enforced by Cloudflare Zero Trust in front of the worker.
- **Monorepo migration scaffold (in progress):**
  - New app scaffolds now exist under `apps/admin`, `apps/admin-worker`, and `apps/web`.
  - Shared package scaffolds now exist under `packages/domain`, `packages/ui`, `packages/cloudflare`, and `packages/config`.
  - Public web runtime source of truth is now `apps/web/*`; admin/admin-worker cutover remains in progress.

## Admin migration direction

- Standalone admin is being stabilized on `apps/admin-worker` with D1/R2 bindings; all future admin capabilities (CRUD, asset writes, alias/suggestion tooling) are planned, designed, and validated on the worker + D1/R2 surface instead of augmenting the legacy `/api/admin/*` debugging layer inside `apps/web`.
- `bun run dev:admin` is the default standalone admin workflow and must start `apps/admin` plus local `wrangler dev` with remote D1/R2 bindings against the remote fact source.
- The admin worker must fail fast when `DB` or `IMAGES` bindings are missing from known admin routes; do not restore local SQLite/image fallback into the standalone admin path.
- Production admin access control is expected to live in Cloudflare Zero Trust; do not reintroduce worker-side password prompts or Basic Auth variables as a parallel gate.
- The legacy `/admin` routes together with `/api/admin/*` inside `apps/web` exist only as migration rollback/reference paths. They are not part of the default standalone admin dev loop.
- Worker-backed admin now owns character CRUD, commission CRUD, alias/suggestion writes, source-image GET, and source-image replacement whenever `DB` / `IMAGES` bindings are present.
- Standalone admin day-to-day development should use `bun run dev:admin`, which starts `apps/admin` plus `apps/admin-worker` in local worker mode with remote bindings and avoids pulling `apps/web` into the loop by default. `bun run dev:admin:remote` remains only as a compatibility alias.

## Home Rendering Architecture

- Home page static markup is Astro-first:
  - `apps/web/src/pages/index.astro`
  - `apps/web/src/features/home/blocks/*.astro`
  - `apps/web/src/features/home/HomeClientScript.astro`
  - `apps/web/src/features/home/server/StaticCommissionSections.astro`
  - `apps/web/src/features/home/commission/*.astro` (listing/timeline/entry rendering chain)
  - `apps/web/src/features/home/nav/DesktopSidebarNav.astro` (desktop nav/search/view/locale shell)
  - `apps/web/src/features/home/nav/hamburger/MobileHamburgerMenu.astro` (mobile hamburger shell)
- Keep React only for interactive islands:
  - `apps/web/src/features/home/search/CommissionSearchDeferred.tsx` (home search island mounted directly from the Astro page shell)
- Home-level side effects are Astro script components:
  - `apps/web/src/features/home/warning/AgeGateScript.astro`
  - `apps/web/src/features/home/HomeClientScript.astro`
  - `apps/web/src/layouts/AnalyticsScript.astro`
  - `apps/web/src/features/home/commission/CommissionImageNoticeScript.astro`
  - `apps/web/src/features/home/dev/DevLiveRefreshScript.astro`
- Astro 6 preserves relative `script` / `style` / `link` order. Treat the current order of home/layout script components as behavior, not formatting, and smoke-test home/admin when reordering them.
- Home runtime side-effect bootstrapping is centralized in:
  - `apps/web/src/features/home/homePageClient.ts`
- Home refresh scroll restoration is centralized in:
  - `apps/web/src/features/home/homeScrollRestore.ts`
  - `apps/web/src/lib/navigation/restoreScrollPosition.ts`
- Home shared cross-module event constants are centralized in:
  - `apps/web/src/features/home/events.ts`
- Home unpublished-interest button state is centralized in:
  - `apps/web/src/features/home/commission/unpublishedInterestClient.ts`
- Home active character lazy-mount behavior is centralized in:
  - `apps/web/src/features/home/commission/activeCharactersLoader.ts`
  - `apps/web/src/features/home/commission/activeCharactersEvent.ts`
- Home stale character lazy-mount behavior is centralized in:
  - `apps/web/src/features/home/commission/staleCharactersLoader.ts`
  - `apps/web/src/features/home/commission/staleCharactersEvent.ts`
- Home active/stale batch planning and payload generation are centralized in:
  - `apps/web/src/features/home/server/homeCharacterBatches.ts`
  - `apps/web/src/features/home/server/homeCharacterBatchPayload.ts`
  - `apps/web/src/pages/search/home-character-batches/[locale]/[status]/[batch].json.ts`
- Home active/stale batch manifest parsing, fetching, and DOM rendering are centralized in:
  - `apps/web/src/features/home/commission/homeCharacterBatchManifest.ts`
  - `apps/web/src/features/home/commission/homeCharacterBatchClient.ts`
  - `apps/web/src/features/home/commission/deferredCharacterBatchPrefetch.ts`
  - `apps/web/src/features/home/commission/homeCharacterBatchPayload.ts`
  - `apps/web/src/features/home/commission/homeCharacterBatchRender.ts`
- Home timeline lazy-mount behavior is centralized in:
  - `apps/web/src/features/home/commission/timelineViewLoader.ts`
- Home timeline batch planning and payload generation are centralized in:
  - `apps/web/src/features/home/server/homeTimelineBatches.ts`
  - `apps/web/src/features/home/server/homeTimelineBatchPayload.ts`
  - `apps/web/src/pages/search/home-timeline-batches/[locale]/[batch].json.ts`
- Home timeline batch manifest parsing, fetching, and DOM rendering are centralized in:
  - `apps/web/src/features/home/commission/homeTimelineBatchManifest.ts`
  - `apps/web/src/features/home/commission/homeTimelineBatchClient.ts`
  - `apps/web/src/features/home/commission/homeTimelineBatchPayload.ts`
  - `apps/web/src/features/home/commission/homeTimelineBatchRender.ts`
- Home desktop navigation behavior is centralized in:
  - `apps/web/src/features/home/nav/sidebarNavEnhancer.ts`
- Home sidebar/hamburger deferred target prefetch and load helper is centralized in:
  - `apps/web/src/features/home/nav/homeNavTargetClient.ts`
- Home mobile top tabs behavior is centralized in:
  - `apps/web/src/features/home/commission/mobileViewModeTabs.ts`
- Home mobile language menu behavior is centralized in:
  - `apps/web/src/features/home/nav/hamburger/mobileLanguageMenu.ts`
- Home mobile hamburger behavior is centralized in:
  - `apps/web/src/features/home/nav/hamburger/mobileHamburgerMenu.ts`
- Home view-panel DOM visibility sync is centralized in:
  - `apps/web/src/features/home/commission/commissionViewModeDomSync.ts`
- Home search/view-mode behavior depends on existing `data-*` DOM contracts; preserve attribute names and structure when editing Astro templates.
- Home search UX policy:
  - Keep the search UI itself synchronously rendered and layout-stable on first paint; do not reintroduce shell-to-real-content swaps that cause visible jump, drift, or delayed keyword chips.
  - `dev` search may read DOM metadata, but `build` output cannot rely on `data-search-*` attributes being present; production search must keep `/search/home-search-entries.json` as a valid index source.
  - Prefer optimizing index/data loading behind a stable UI shell over lazy-loading the entire search island. If revisiting async loading, prove identical DOM footprint before and after hydration.
  - Active/stale deferred sections now resolve through an inline manifest plus external batch JSON. Preserve the existing `id` / `data-*` DOM contracts inside batch payloads so sidebar, hamburger, hash navigation, and search stay deterministic.
  - `data-stale-visibility` means the stale group is expanded; `data-stale-loaded` means deferred stale sections are fully mounted. Preserve that distinction when touching search/nav/scroll-restore state.
  - Character/stale section templates must mount with their full entry list intact. Do not reintroduce per-section entry lazy mounts above anchor targets; they break deterministic sidebar/hash navigation.
  - Search island locale labels should resolve from `apps/web/src/features/home/i18n/homeSearchControls.ts` so client bundles do not import the full `homeLocale` message graph.
- Shared pure rendering helpers:
  - `apps/web/src/features/home/commission/linkDisplay.ts` (link sanitization/priority selection)
  - `apps/web/src/features/home/commission/templateContentLookup.ts` (recursive template-content id lookup for deferred hash/search flows)
  - `apps/web/src/lib/images/sourceImageRegistry.ts` (source image lookup by commission fileName)

## Admin Rendering Architecture

- Legacy admin routes now exist only as unmounted reference Astro page shells:
  - `apps/web/src/devAdmin/pages/adminIndex.astro`
  - `apps/web/src/devAdmin/pages/adminCreate.astro`
  - `apps/web/src/devAdmin/pages/adminEdit.astro`
  - `apps/web/src/devAdmin/pages/adminAliases.astro`
  - `apps/web/src/devAdmin/pages/adminSuggestion.astro`
- Their static page structure (title/description/navigation/fallback) stays in Astro templates.
- Their interactive admin state is isolated to React islands:
  - `apps/web/src/features/admin/islands/AdminCreateIsland.tsx`
  - `apps/web/src/features/admin/islands/AdminEditIsland.tsx`
- Reference-only admin UI remains React:
  - `apps/web/src/features/admin/AddCharacterForm.tsx`
  - `apps/web/src/features/admin/AddCommissionForm.tsx`
  - `apps/web/src/features/admin/CommissionManager.tsx`
  - `apps/web/src/features/admin/aliases/AliasesDashboard.tsx`
  - `apps/web/src/features/admin/suggestion/SuggestionDashboard.tsx`
  - form/dnd/search subcomponents in `apps/web/src/features/admin/*`
- Shared not-found presentation is Astro-first:
  - `apps/web/src/components/shared/NotFoundPage.astro`

## Dev/Admin Responsibilities (must follow)

- `apps/web/src/devAdmin` route shells and `apps/web/src/features/admin` UI are legacy reference code. Standalone admin work must happen in `apps/admin` + `apps/admin-worker`, not inside `apps/web`.
- In production behavior, `/admin` should not expose editing and must return 404 via route guards + static redirect rules.
- All write operations (`create*`, `update*`, `deleteCommission`, `save*`) are valid only when `NODE_ENV=development`.
- Always import actions from `#admin/actions` so components stay on the HTTP API wrapper path.

## Build Timing & Validation Gates

Run checks in this order before pushing:

1. `bun dev` — smoke-check local startup and key public page routing.
2. `bun run lint` — run ESLint in check mode and resolve any remaining issues.
3. `bun run check` — run Astro type-check diagnostics for `.astro`/TypeScript integration.
4. `bun run test` — run unit/component tests (Vitest).
5. `bun run test:visual` — run Playwright visual regression when changing layout, iconography, spacing, floating menus, or admin/home shells.
6. `bun run build` — required for commits that change runtime behavior, data access, routes, configs, or component logic.

Additional guidance:

- For docs-only edits, `bun run lint` is still recommended; `bun run build` can be skipped only when no runtime-related files changed.
- Use `bun run lint:fix` only when you explicitly want ESLint to rewrite files.
- If `apps/web/server/adminApi.ts` or admin/data-access code changed, `bun run build` is mandatory.
- If `.astro` files or Astro script blocks are modified, `bun run check` is mandatory.
- Run `bun run test` whenever you modify:
  - `apps/web/src/devAdmin/*`, `#admin/actions`, `apps/web/server/adminApi.ts`, `apps/web/src/lib/admin/db.ts`, `apps/web/astro.config.ts`
  - Rendering/component logic in `apps/web/src/components/*` and `apps/web/src/pages/*`
  - Search/filter/date parsing logic or other user-visible behavior in `apps/web/src/lib/*` and `apps/web/data/*`
- Run `bun run test:visual` whenever you modify:
  - `apps/web/src/features/home/search/*`
  - `apps/web/src/features/home/nav/*`
  - `apps/web/src/features/home/nav/hamburger/*`
  - `apps/web/src/features/admin/suggestion/*`
  - icon sizing/placement in shared UI primitives such as `apps/web/src/components/ui/*`

## Server Runtime Architecture

- Legacy Astro dev integration for admin route injection and dev-only API middleware (currently not wired into `astro.config.ts`):
  - `apps/web/server/devAdminAstro.ts`
- Standalone dev admin API server:
  - `apps/web/server/adminApi.ts`
- Legacy API route handler reference:
  - `apps/web/server/adminApiHandler.ts`
- Shared Node/Web bridge helpers:
  - `apps/web/server/httpBridge.ts`
- Source-image dev watcher integration:
  - `apps/web/server/assetsPipelineAstro.ts`

## Change Log

- Added a minimal `turbo.json`, switched root `build:web` / `build:admin` / `check` / `typecheck` entrypoints to `turbo run`, and taught GitHub Actions to restore `.turbo/` before the existing deploy flow.
- Added `.github/workflows/ci.yml` for standard push/PR verification, and added `apps/web` `check:astro` / `build:astro` scripts so CI can reuse already-exported generated inputs without triggering duplicate fact-source exports.
- Removed duplicate pre-build/pre-export steps from deploy/rebuild GitHub Actions workflows so those jobs now rely on workspace-local Wrangler custom builds instead of running the same web/admin build chain twice.
- Added GitHub Actions step summaries for CI/deploy/rebuild so cache-hit state and per-step timings are visible without digging through raw logs.
- Tightened CI to avoid duplicate branch push runs, moved Cloudflare credential detection ahead of the remote web job, restored/saved full `apps/web/generated` inputs for later Astro validation, and added `apps/web` `typecheck` so root Turbo validation no longer skips the web workspace.
- Removed the repo-root `wrangler.jsonc`, localized deploy/build intent to `apps/web/wrangler.jsonc` and `apps/admin-worker/wrangler.jsonc`, added `apps/admin-worker` `build:assets`, and documented the required Cloudflare Workers Builds root/build/deploy settings for push-triggered monorepo deploys.
- Added `apps/admin-worker/src/adminSourceImages.ts`, moved worker-native commission CRUD plus `POST /api/admin/commissions/:id/source-image` onto D1/R2-backed execution when bindings exist, and extended admin worker contract tests to cover native create/update/delete/replace behavior.
- Added root `scripts/devAdminRemote.ts`, root `dev:admin:remote`, repo-level Cloudflare Builds/deploy helper scripts, and worker `dev:remote` so standalone admin development and Cloudflare deployment can run from the workspace root without depending on `apps/web`.
- Removed worker-side Basic Auth from `apps/admin-worker` and moved production admin authentication responsibility to Cloudflare Zero Trust in front of `admin.crystallize.cc`.
- Declared `DB` / `IMAGES` bindings plus a D1 migrations directory in `apps/admin-worker/wrangler.jsonc`, and added remote bootstrap scripts to mirror the current SQLite/image truth into the D1/R2 fact source.
- Added `apps/admin-worker/src/adminData.ts` so worker read routes can serve bootstrap, aliases, suggestion, character commissions, and source-image GETs from D1/R2 bindings before falling back to the legacy bridge.
- Added worker-native D1 persistence for character create/update/reorder/delete and made `apps/admin-worker` prefer native character CRUD when `DB` bindings exist.
- Added worker-owned D1 persistence for alias batch saves and featured-keyword suggestion writes, removed those routes from the primary legacy passthrough path when bindings exist, and extended admin worker contract coverage.
- Merged batch write routes (aliases, suggestion) from removed `apps/admin-worker/src/adminWriteApi.ts` into `adminApi.ts`; removed dead `assets/refresh` endpoint.
- Moved standalone admin CRUD route matching/validation into `apps/admin-worker/src/adminApi.ts` and added worker contract tests.
- Moved Vitest and Playwright configuration to repository-root entrypoints, kept app-owned suites under `apps/*/test`, moved committed Playwright baselines to root `test/visual/apps/*`, routed generated test outputs to root directories, and started downshifting web runtime/build dependencies out of the root workspace manifest.
- Migrated the standalone `edit` route in `apps/admin`, bridged edit CRUD/source-image/refresh flows through `apps/admin-worker`, and added standalone edit visual regression coverage.
- Migrated the standalone `create` route in `apps/admin`, bridged create writes through `apps/admin-worker`, and added standalone create visual regression coverage.
- Migrated the standalone `aliases` route in `apps/admin`, bridged alias batch-save endpoints through `apps/admin-worker`, and added standalone aliases visual regression coverage.
- Migrated the standalone `suggestion` route in `apps/admin`, added worker-backed featured-keyword save/load flows, and extended the admin worker legacy bridge to proxy suggestion writes during the migration window.
- Bridged standalone admin overview data through `apps/admin-worker`, added local worker CORS/dev-auth handling for Vite-to-worker requests, and switched `apps/admin` overview to live worker-backed counts/latest entries.
- Moved timeline grouping and year-navigation helpers into `packages/domain`, leaving `apps/web` timeline modules as bridge exports.
- Aligned root ESLint peer dependencies and fixed remaining repo lint violations so `bun run lint` works from the workspace root.
- Moved alias normalization, date-search token helpers, commission filename parsing, and commission search metadata builders into `packages/domain`, leaving `apps/web` wrappers as bridge exports.
- Extracted shared `character` / `commission` / alias / suggestion type contracts into `packages/domain` and switched `apps/web` to consume the package export surface.
- Added a workspace-local React server renderer shim in `apps/web/src/config/astroReactServerShim.ts` so Astro prerender/build works after moving the app into `apps/web`.
- Moved the Astro runtime from repository root into `apps/web` (including `src`, `server`, `data`, `public`, and `test`) and switched root scripts to delegate to the new workspace app.
- Added initial monorepo migration scaffolds under `apps/*` and `packages/*`, including standalone admin/frontend and admin worker placeholders with dedicated `wrangler.jsonc` files.
- Tightened admin write gating to `NODE_ENV=development` only, moved the shared runtime check to `apps/web/src/lib/admin/environment.ts`, and added admin-side data health / duplicate-entry warnings for safer maintenance.
- Unified the 404 implementation on the Astro route and removed the redundant static `apps/web/public/404.html` fallback that was shadowing `apps/web/src/pages/404.astro` during build.
- Split home client boot into critical immediate mounts (`view sync` + deferred-content loaders + scroll restore) and idle-mounted non-critical enhancers (`sidebar/hamburger/language/tabs/unpublished-interest`) inside `apps/web/src/features/home/homePageClient.ts`.
- Updated `apps/web/src/features/home/commission/timelineViewLoader.ts` to pipeline timeline batch fetches with bounded concurrency before ordered DOM mounting, reducing RTT chaining when loading multiple timeline batches.
- Moved deferred timeline sections from inline templates to external locale-aware batch JSON routes, and switched timeline loader mounting to manifest-driven fetch/render with legacy template fallback.
- Split search island locale controls into `apps/web/src/features/home/i18n/homeSearchControls.ts` and changed production search-index warmup to `idle` + first-interaction fallback to cut initial main-thread/network pressure.
- Added cache headers for `/search/home-search-entries.json`, `/search/home-character-batches/*`, `/search/home-timeline-batches/*`, and `/rss.xml` in `apps/web/public/_headers`.
- Removed the Bun subprocess-driven asset sync path; home update summary now computes at page render, `/search/home-search-entries.json` and `/rss.xml` are served by Astro routes, and admin write flows no longer require script-side asset regeneration.
- Consolidated shared home event constants into `apps/web/src/features/home/events.ts`, removing tiny single-purpose event files for view-mode change, scroll-restore abort, and hamburger mounted state.
- Consolidated custom dev/build workflow hooks into Astro integrations, removing the bespoke admin Vite middleware plugin, inline source-image watcher plugin, and the extra asset-sync CLI hop.
- Consolidated shared home sidebar/hamburger target prefetch and deferred-load wiring into `apps/web/src/features/home/nav/homeNavTargetClient.ts` to reduce duplicate navigation-side client logic.
- Removed the thin `HomeControlsIsland`, `AdminSuggestionIsland`, and `AliasesDashboardIsland` wrappers so home/admin Astro entrypoints mount their actual React islands directly.
- Upgraded timeline mode to year-batched lazy loading with manifest-driven target resolution, preserving always-enabled year nav link styling while loading dots/sections progressively (`apps/web/src/features/home/server/homeTimelineBatches.ts`, `apps/web/src/features/home/commission/timelineViewEvent.ts`, `apps/web/src/features/home/commission/timelineViewLoader.ts`, `apps/web/src/features/home/server/StaticCommissionSections.astro`).
- Consolidated deferred active/stale target prefetching into `apps/web/src/features/home/commission/deferredCharacterBatchPrefetch.ts`, reused by sidebar + hamburger nav to remove duplicate batch-target logic.
- Consolidated window scroll restoration behavior into `apps/web/src/lib/navigation/restoreScrollPosition.ts` and reused it across stale loader + home reload restore.
- Added search-side request de-dup guards so active/stale `strategy: 'all'` load requests are dispatched once per matching query state instead of repeating on every render.
- Split admin maintenance workflow into dedicated `/admin/create` and `/admin/edit` routes, converted `/admin` into an overview dashboard, and reordered section nav so overview is first.
- Aligned the project with Astro 6 defaults by making `redirectToDefaultLocale` explicit, removing Vite plugin type annotations that conflict with Astro's config typing, and documenting CSP guardrails instead of enabling an unstable path in the current stack.
- Added an empty `apps/web/src/content.config.ts` so Astro dev no longer warns when the project does not use content collections.
- Removed the React-only home locale context/provider and now pass locale into the search island via plain props.
- Simplified home/admin search view-mode wiring to a direct URL/event subscription hook and removed the unused deferred panel provider path.
- Restored unpublished `Want this` button client behavior with localStorage-backed disable/hydration flow after the Astro migration regression.
- Removed unused React hamburger leftovers (`apps/web/src/features/home/nav/Hamburger.tsx`, `apps/web/src/features/home/nav/hamburger/MenuContent.tsx`, `apps/web/src/features/home/nav/hamburger/CharacterMenuList.tsx`, `apps/web/src/features/home/nav/hamburger/Icons.tsx`) after the Astro mobile menu migration.
- Removed the deferred SearchShell handoff so home/admin search now render the real `CommissionSearch` immediately and only defer index construction.
- Switched admin/server business filenames to camelCase (`adminApi*`, `devAdminAstro`, `assetsPipelineAstro`).
- Moved dev admin Astro routes to `apps/web/src/devAdmin/pages/*`.
- Migrated effect-only home/layout side effects to Astro script components.
- Migrated age gate warning from React island to Astro script.
- Migrated commission image notice gate/client from React to Astro script + DOM module.
- Migrated sidebar click/hash/search-link enhancer from React effect component to Astro script.
- Migrated desktop sidebar navigation (search/view-mode/locale list) from React to Astro + script module.
- Migrated mobile top view-mode tabs from React to Astro + script module.
- Migrated mobile language floating menu from React popover to Astro `details` + script module.
- Migrated mobile hamburger navigation from React island to Astro + script module.
- Removed unused migration leftovers (`CommissionViewModeDomSync.tsx`, `useDocumentTitle`, `apps/web/src/lib/index.ts`).
- Added dev-only `/admin/suggestion` page to curate featured home search keywords (select + DnD + manual input).
- Added `home_featured_search_keywords` SQLite config table and home-side featured keyword hydration path.
- Added keyword alias management (`keyword_aliases`) to `/admin/aliases` with shadcn tabs and bootstrap/action API wiring.
- Added character alias management (`character_aliases`) to `/admin/aliases` and unified search-suggestion alias display mapping with source priority (`character > creator > keyword`).
- Added shared server request/response bridge utility and test coverage.
- Added active-character lazy-mount pipeline (`template` + loader script + navigation/search load requests) so the home page no longer renders every active character section up front.
- Added stale character lazy-loading pipeline (`template` + loader script + sidebar/search sync events) to reduce initial DOM size while preserving navigation discoverability.
- Split stale state into `visibility` vs `loaded`, and made manual stale expansion mirror active by mounting the first stale section immediately and deferring the remainder behind a sentinel/full-load request path.
- Added a shared home scroll-restore abort event so explicit sidebar/hamburger jumps can cancel pending reload restoration before it overrides the user's navigation.
- Added timeline lazy-mount pipeline (`template` + loader script + search/sidebar sync events) so the hidden timeline view no longer doubles the initial homepage DOM.
- Collapsed most home side-effect entrypoints into `HomeClientScript.astro` + `homePageClient.ts` to reduce initial module requests without changing DOM contracts.
- Added Playwright visual regression baselines for home search/nav shells, mobile floating menus, and the admin featured-keyword dashboard.
- Removed the per-section commission-entry lazy-mount layer so sidebar and update-link anchor jumps stay stable after section templates mount.
- Added home-side reload scroll restoration so lazy-mounted sections can rehydrate before restoring the reader's saved position.
- Replaced embedded active/stale deferred section templates with inline manifest + external batch JSON payloads so the home page can lazy-load section batches more aggressively without sacrificing deterministic sidebar/hash/refresh restore behavior.

## Code Style

- Format code with ESLint auto-fix (`bun run lint:fix`): single quotes, no semicolons, trailing commas, `arrowParens: avoid`, width 100.
- ESLint uses a TypeScript baseline; keep the code free of lint errors.

## Images

- Frontend listing images are rendered with Astro Image (`astro:assets`) from `apps/web/generated/source-images/*.{jpg,jpeg,png}` source files.
- Source file resolution is centralized in `apps/web/src/lib/images/sourceImageRegistry.ts`; keep commission `fileName` and source image stem aligned.
- Home listing image widths are fixed at `768/960/1280` and `sizes="(max-width: 768px) 92vw, 640px"` to keep analytics variant labels stable.
- Dev mode includes a generated fact-source watcher (`apps/web/server/assetsPipelineAstro.ts`) that full-reloads when `apps/web/generated/*` changes.
- Admin preview image URL uses dev-only API: `GET /api/admin/source-image/:fileName`.
- `/images/webp/*` is no longer a supported runtime contract.

## Commit Etiquette

- Commit only source files; exclude generated or build artifacts such as `dist/`, `.next/`, `out/`, etc.
- Keep each commit focused on one objective.
- Use this commit message format: `type(scope): short summary`.
- Allowed `type` values: `feat`, `fix`, `docs`, `refactor`, `chore`, `test`, `style`, `perf`, `build`, `ci`, `revert`, `data`.
- Keep `short summary` in imperative mood, lowercase first letter, and under 72 characters.
- If needed, add a blank line and body bullets describing what changed and why.

## Task Boundaries

- **Allowed:** complete functions, add API handlers, adjust UI components, write or expand tests.
- **Disallowed:** upgrade dependencies, change security policies, alter existing API contracts.

## Interaction Protocol

- Begin responses with a brief plan or reasoning.
- Provide a list of intended changes.
- Conclude with consolidated code blocks.
- Prefer minimal, incremental edits; avoid large refactors.
- Offer multiple options when unsure and explain trade-offs.

## Security & Privacy

- Use environment variables such as `HOSTING` for secrets.
- Do not commit `.env` files or API keys.
- Avoid embedding credentials in code or comments.
