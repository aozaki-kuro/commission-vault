# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Commission Index — a personal commission listing/indexing site. Bun monorepo with Astro 6 static site (public web), React 19 SPA (admin), and Cloudflare Worker (admin API). Data lives in remote D1/R2.

## Commands

```bash
# Dev
bun run dev              # web Astro dev (localhost:4321)
bun run dev:admin        # admin frontend + worker with remote D1/R2 (localhost:4174 + :8787)

# Build
bun run build            # build apps/web static output
bun run build:all        # build all workspaces via Turbo
bun run build:admin      # build admin only

# Validate
bun run lint             # ESLint check
bun run lint:fix         # ESLint auto-fix
bun run check            # Astro type-check (.astro + TS)
bun run typecheck        # TS check all workspaces via Turbo

# Test
bun run test             # Vitest unit tests (all workspaces)
bun run test:watch       # Vitest watch mode
bun run test:changed     # test changed files only
bun run test:visual      # Playwright visual regression
bun run test:visual:update  # update Playwright baselines

# Deploy (manual)
bun run deploy:web       # deploy public site Worker
bun run deploy:admin     # deploy admin Worker
```

## Architecture

### Workspace Layout

```
apps/web            Astro 6 static site — public runtime (crystallize.cc)
apps/admin          React 19 + Vite 8 SPA — admin UI (admin.crystallize.cc)
apps/admin-worker   Cloudflare Worker — admin API, D1/R2 CRUD, asset serving
packages/domain     Shared types and pure domain helpers (no app imports)
```

### Tech Stack

- **Runtime:** Node 24 (mise) + Bun (package manager + scripts)
- **Build orchestration:** Turbo (cacheable tasks only; deploy stays outside Turbo)
- **Public site:** Astro 6 + Tailwind CSS 4 + React 19 islands (selective hydration)
- **Admin frontend:** React 19 + Vite 8 + Tailwind CSS + shadcn/ui
- **Admin backend:** Cloudflare Worker + D1 (SQL) + R2 (images)
- **Testing:** Vitest + Playwright (visual regression)
- **Lint:** @antfu/eslint-config — single quotes, no semicolons, trailing commas, width 100

### Data Flow

1. Admin writes to remote D1/R2 via `apps/admin-worker`
2. `exportWebFactSource.ts` exports D1/R2 -> `apps/web/generated/*` (JSON + source images)
3. Astro builds static HTML from `generated/*` — no runtime D1/R2 access
4. `apps/web/wrangler.jsonc` carries read-only D1/R2 bindings for build-time export

### Home Page Architecture (Astro-first)

Static markup is Astro templates; React is only for the search island (`CommissionSearchDeferred.tsx`). Client-side behavior uses Astro script components (`HomeClientScript.astro`) and vanilla TS modules — not React.

Key patterns:

- **Deferred sections:** Active/stale character sections and timeline use inline manifest + external batch JSON, lazy-loaded via script loaders
- **DOM contracts:** `data-*` attributes drive search/nav/hash navigation — preserve attribute names when editing templates
- **`data-stale-visibility`** = stale group expanded; **`data-stale-loaded`** = deferred stale sections mounted
- Character/stale section templates must mount with full entry list intact (no per-section entry lazy mounts above anchor targets)

### Admin Architecture

- Standalone admin uses `apps/admin` + `apps/admin-worker`; legacy `/admin` routes in `apps/web` are reference-only
- Worker owns all CRUD: character, commission, aliases, suggestions, source images
- Production auth: Cloudflare Zero Trust (no worker-side auth)
- Worker fails fast when D1/R2 bindings are missing — no legacy fallback

### Path Aliases (apps/web)

`#layouts/*`, `#features/*`, `#components/*`, `#images/*`, `#data/*`, `#lib/*`, `#styles/*`, `#config/*`, `#admin/*`

## Validation Gates (pre-push order)

1. `bun run dev` — smoke-check local startup
2. `bun run lint` — ESLint
3. `bun run check` — Astro type-check (mandatory when `.astro` files changed)
4. `bun run test` — unit tests
5. `bun run test:visual` — visual regression (when touching search/nav/admin UI shells)
6. `bun run build` — full build (mandatory for runtime/route/config/data changes)

## Guardrails

### Astro 6

- Keep `i18n.routing.redirectToDefaultLocale` explicit
- Keep `apps/web/src/content.config.ts` present even when empty (suppresses dev warning)
- Do not enable CSP (Shiki inline styles conflict; analytics needs `https://sight.crystallize.cc`)

### Dependency Boundaries

- `apps/web` imports from `packages/*` only — never from `apps/admin` or `apps/admin-worker`
- `packages/domain` is app-agnostic — never imports from `apps/*`
- Admin features go in `apps/admin` + `apps/admin-worker`, not `apps/web`

### Cloudflare Deploy

- No repo-root `wrangler.jsonc` — each Worker owns its own config
- Workers Builds connects same repo to two Workers with different root dirs (`apps/web` and `apps/admin-worker`)
- Web Turbo cache must include `WEB_BUILD_CACHE_TOKEN` for remote-data invalidation
- Deploy/rebuild workflows must not pre-run export/build before `wrangler deploy` (workspace-local custom build commands already handle it)

### Search UX

- Search UI must be layout-stable on first paint — no shell-to-content swaps
- Production search index: `/search/home-search-entries.json` (not DOM metadata)
- Search island locale labels resolve from `homeSearchControls.ts` (not the full `homeLocale` graph)

### Images

- Source images: `apps/web/generated/source-images/*.{jpg,jpeg,png}`
- Resolution: `sourceImageRegistry.ts` — commission `fileName` stem must match source image stem
- Listing widths: `768/960/1280`, sizes `(max-width: 768px) 92vw, 640px`

## Commit Convention

```
type(scope): short imperative summary (lowercase, <72 chars)
```

Allowed types: `feat`, `fix`, `docs`, `refactor`, `chore`, `test`, `style`, `perf`, `build`, `ci`, `revert`, `data`

## Dev Ports

| App                          | Port |
| ---------------------------- | ---- |
| apps/web (Astro)             | 4321 |
| apps/admin (Vite)            | 4174 |
| apps/admin-worker (Wrangler) | 8787 |
