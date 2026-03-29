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
bun run dev            # web (4321)
bun run dev:admin      # admin worker (8787) + frontend (4174), remote D1/R2
bun run preview        # preview apps/web/dist/ locally
```

## Build

```bash
bun run build          # Astro → apps/web/dist/
bun run build:admin    # admin Worker + SPA assets
bun run build:all      # all workspaces via Turbo
bun run typecheck      # TS check all workspaces
```

## Quality

```bash
bun run lint           # ESLint, zero warnings
bun run lint:fix
bun run test
bun run test:watch
```

## Setup (fresh machine)

```bash
mise install
bun install            # from repo root only
```

## Deploy

```bash
bun run deploy:web     # → commission-index-web
bun run deploy:admin   # → commission-index-admin
```

Push-triggered via Workers Builds — each worker owns its `wrangler.jsonc`.
