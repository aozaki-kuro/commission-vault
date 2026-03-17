# Test AGENTS

## Tree

test/

- `visual/helpers.ts`: shared screenshot stabilization, clipping, and project-gating helpers for admin visual tests.
- `visual/admin-legacy-reference.spec.ts`: captures legacy `/admin/*` reference screenshots from `apps/web` under the `admin-legacy` Playwright project.
- `visual/admin-suggestion.spec.ts`: standalone admin Playwright visual regression for the suggestion page.

## Rules

- Keep standalone admin visual regression targeting `apps/admin`, not `apps/web`.
- Keep legacy reference capture in the dedicated `admin-legacy` Playwright project; do not mix those snapshots into ad hoc manual screenshots.
- When a standalone route is not fully migrated yet, preserve its legacy reference baseline here first and only enable direct standalone comparison after the page matches.
- When the suggestion page shell or worker-backed bootstrap behavior changes, run `bun run test:visual`.
