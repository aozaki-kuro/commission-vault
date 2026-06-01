# admin

Standalone admin frontend: React 19 + Vite 8 SPA served from `admin.crystallize.cc`.

## Responsibilities

- Talks only to admin worker API via `ADMIN_API_BASE_URL`
- Default dev: `pnpm run dev:admin` from repo root (pairs frontend with local worker + remote D1/R2)
- Preserve existing admin visual design, spacing, typography
- Where admin uses shadcn/Radix primitives, preserve them (don't downgrade to native controls)

## Key Structure

- `src/App.tsx` — path-based page routing
- `src/app/sections.ts` — route definitions and metadata
- `src/app/ui.ts` — shared Tailwind class contracts
- `src/lib/adminActions.ts` — worker-backed form actions
- `src/lib/adminApi.ts` — API URL resolution and fetch helpers
- `src/pages/` — route pages (overview, create, edit, aliases, suggestion)
- `src/components/` — migrated admin React components

## API Documentation

Before touching fetch logic or form actions, read:

- `docs/api-reference.md` — endpoint signatures and field types
- `docs/ai-agent-guide.md` — retry strategy, links encoding, `hidden` field quirks, alias batch semantics

## Guardrails

- Route paths rooted at `/` on `admin.crystallize.cc` — no `/admin/*` public-site coupling
- Validate every migrated page with Playwright visual regression
- Validate admin pages with Playwright visual regression
