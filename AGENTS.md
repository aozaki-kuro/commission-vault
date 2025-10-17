# AGENTS

This repository contains a Next.js 15 application written in TypeScript and managed with Bun.

## Development Notes

- **Runtime & package manager:** Node 22 via [mise](https://mise.jdx.dev) and `bun` for all commands.
- **Framework:** Next.js with the `app/` router and Tailwind CSS.
- **Path aliases:** Prefer the `#components`, `#images`, `#commission`, `#data`, `#lib`, and `#admin/*` aliases (`#admin/actions` swaps between dev + stub automatically).
- **Data source:** Commission content now lives in `data/commissions.db`; access it through `data/sqlite.ts` (Bun uses `bun:sqlite`, Node falls back to `better-sqlite3`).

## Domain Concepts

- **Commission** – `{ fileName: string, Links: string[], Design?: string, Description?: string, Hidden?: boolean }`
- **CharacterCommissions** – `{ Character: string, Commissions: Commission[] }`
- **Props** – `CharacterCommissions[]`; default data shape for components and pages.
- **commissionData** – merged & filtered `Props` loaded from SQLite and sorted by date.
- **commissionDataMap** – `Map<string, CharacterCommissions>` for quick lookup.
- **characterStatus** – active/stale character listing in `data/commissionStatus.ts`.
- **AdminData** – `{ characters: CharacterRow[], commissions: CommissionRow[] }` returned by `#lib/admin/db` for the admin dashboard.

## Admin Tools

- The development-only dashboard lives under `app/(dev)/admin` and is served from `/admin`; production requests fall through to `notFound()`.
- Import server actions from `#admin/actions`; Next routes this to `actions.dev.ts` when `NODE_ENV=development` and to the stub otherwise.
- Writable database operations (`create*`, `update*`, `deleteCommission`) are blocked outside development; ensure `NODE_ENV` is `development` before mutating data.
- Editing data via the admin UI updates `data/commissions.db`; commit that file alongside related changes so the static export stays in sync.
- If the SQLite file goes missing, create it (seed script WIP) before running the dashboard or build commands.

## Code Style

- Format code with Prettier: single quotes, no semicolons, trailing commas, `arrowParens: avoid`, width 100.
- ESLint follows Next.js recommendations with Prettier integration; keep the code free of lint errors.

## Required Commands

Run these before pushing changes:

1. `bun dev` – start local development server.
2. `bun run lint` – auto-fix and check formatting/linting.
3. `bun run build` – ensure the project compiles.

_No automated tests currently. Add and run them when introduced._

## Images

- To add or update images, run `bun run scripts/convert.ts` to optimize images and `bun run scripts/imageImport.ts` to refresh `data/imageImports.ts`.

## Commit Etiquette

- Commit only source files; exclude generated or build artifacts such as `.next/`, `dist/`, `out/`, etc.

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
