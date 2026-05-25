# Commission Index

Don't look. Personal use only.

## Workspaces

|                     |                                            |
| ------------------- | ------------------------------------------ |
| `apps/web`          | Astro 6 static site (crystallize.cc)       |
| `apps/admin`        | React 19 + Vite SPA (admin.crystallize.cc) |
| `apps/admin-worker` | Cloudflare Worker — D1/R2 CRUD + admin API |
| `packages/domain`   | Shared types and domain helpers            |

## Dev

```bash
pnpm run dev            # web (4321)
pnpm run dev:admin      # admin worker (8787) + frontend (4174), remote D1/R2
pnpm run preview        # preview apps/web/dist/ locally
```

## Build

```bash
pnpm run build          # Astro → apps/web/dist/
pnpm run build:admin    # admin Worker + SPA assets
pnpm run build:all      # all workspaces via Turbo
pnpm run typecheck      # TS check all workspaces
```

## Quality

```bash
pnpm run lint           # ESLint, zero warnings
pnpm run lint:fix
pnpm run test
pnpm run test:watch
```

## Setup (fresh machine)

```bash
mise install
pnpm install            # from repo root only
```

## Deploy

```bash
pnpm run deploy:web     # → commission-index-web
pnpm run deploy:admin   # → commission-index-admin
```

Push-triggered via Workers Builds — each worker owns its `wrangler.jsonc`.
