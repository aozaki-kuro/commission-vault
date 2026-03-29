# Plan: Rewrite README.md

## Context

The current README.md (122 lines) is an internal ops/decision-log document masquerading as a README. It has no project description, buries commands in prose, and dedicates 40+ lines to rationale for infrastructure decisions that belong in CLAUDE.md. The user wants a proper README.

## Goal

A clean, scannable ~65-line reference document that describes what the project is, shows workspace layout and commands in tables, and cuts all decision-log prose.

---

## Structure of the New README

### 1. Header (keep verbatim)

```
# Commission Index

Don't look.

Personal use only
```

### 2. What this is (new — ~4 lines)

Two-sentence description + live URLs. Currently completely absent.

> Personal commission listing site. Admin writes to Cloudflare D1/R2 via an API Worker; a build-time export step snapshots that data into `apps/web/generated/*`; Astro builds a fully static public site from that snapshot.
>
> Live at **crystallize.cc** · Admin at **admin.crystallize.cc**

### 3. Workspace (new table — ~8 lines)

Replace scattered prose with one table:

| Package             | Description                                             |
| ------------------- | ------------------------------------------------------- |
| `apps/web`          | Astro 6 + Tailwind + React islands → static public site |
| `apps/admin`        | React 19 + Vite SPA → admin UI                          |
| `apps/admin-worker` | Cloudflare Worker + D1 + R2 → admin API                 |
| `packages/domain`   | Shared types and pure domain helpers                    |

Plus one line: "All dependencies install from the repo root. Do not `bun install` inside individual apps."

### 4. Commands (3 grouped tables — ~22 lines)

**Development**
| `bun run dev` | Astro dev → port 4321 |
| `bun run dev:admin` | Wrangler dev (8787) + admin Vite frontend (4174), remote D1/R2 |
| `bun run dev:worker` | Wrangler dev only |
| `bun run preview` | Preview `apps/web/dist/` locally |

**Build & type-check**
| `bun run build` | Astro static build → `apps/web/dist/` |
| `bun run build:admin` | Admin Worker + SPA assets |
| `bun run build:all` | All workspace builds via Turbo |
| `bun run typecheck` | All workspace typechecks via Turbo |
| `bun run check` | Astro check (requires `generated/*`) |

**Quality**
| `bun run lint` / `lint:fix` | ESLint, zero warnings |
| `bun run test` | Vitest suite |
| `bun run test:watch` | Vitest watch mode |
| `bun run test:changed` | Changed files only |

Cut: alias commands (`dev:web`, `dev:admin:remote`, `build:web`) — they exist for tooling, not humans.

### 5. Setup (condensed — ~5 lines)

Keep the numbered steps, drop the 7-line workspace notes block (workspace install note goes to Section 3; rest belongs in CLAUDE.md).

1. `mise install`
2. `bun install` (from repo root)

Verify: `bun run lint && bun run test`

### 6. Deploy (2 tables — ~10 lines)

Cut ~18 lines of rationale. Keep only:

Manual:
| `bun run deploy:web` | → crystallize.cc |
| `bun run deploy:admin` | → admin.crystallize.cc |

Push-triggered (Cloudflare Workers Builds):
| Worker | Root dir | Build command | Deploy command |
| `commission-index-web` | `apps/web` | `bun run build` | `bun run deploy` |
| `commission-index-admin` | `apps/admin-worker` | `bun run build:assets` | `bun run deploy` |

### 7. CI / Tests (merged — ~4 lines)

Merge the 3-line Tests section and 14-line CI changelog into 3 facts:

- CI runs on PRs + pushes to `master`: lint, typecheck, build, test
- Web build requires Cloudflare credentials (`Web Remote Validate` job gates on secret availability)
- Dev ports: web `4321`, admin-worker `8787`, admin Vite `4174`

---

## What to Cut (and Where It Goes)

| Removed content                                    | Where it belongs instead     |
| -------------------------------------------------- | ---------------------------- |
| Workspace install rationale (lines 23–29)          | Already in CLAUDE.md         |
| Turbo cache architecture details                   | CLAUDE.md                    |
| "Do not keep a repo-root wrangler.jsonc" rationale | CLAUDE.md (already there)    |
| Workers Builds monorepo inference note             | CLAUDE.md                    |
| `WEB_BUILD_CACHE_TOKEN` rationale                  | CLAUDE.md (add if missing)   |
| `check:astro` / `build:astro` script notes         | CLAUDE.md                    |
| CI workflow changelog (lines 84–91)                | Git history / workflow files |
| Asset generation section (lines 93–98)             | CLAUDE.md                    |
| `curl -I` 404 verification block (lines 107–121)   | CLAUDE.md (add if missing)   |

**Note:** Before removing the `curl -I` block and `WEB_BUILD_CACHE_TOKEN` note from README, verify they're captured in `CLAUDE.md` or `apps/web/CLAUDE.md`. If not, add them there first.

---

## Critical Files

- `/Users/aozaki/GitHub/commission-index/README.md` — rewrite target
- `/Users/aozaki/GitHub/commission-index/CLAUDE.md` — verify/absorb any cut content before removing

---

## Verification

After writing:

1. Read the new README — can someone understand what the project is in 30 seconds? ✓
2. Are all commands findable without reading prose? ✓ (tables)
3. Is the deploy section actionable without context? ✓
4. Nothing removed that wasn't already in CLAUDE.md or git history? ✓
5. Line count ≤ 70? ✓ (target: 65–70)
