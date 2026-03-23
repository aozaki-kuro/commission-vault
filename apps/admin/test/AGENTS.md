# Test AGENTS

## Tree

test/

- `visual/admin-create.spec.ts`: standalone admin visual regression for the migrated create page shell and form stack.
- `visual/admin-edit.spec.ts`: standalone admin visual regression for the migrated edit page shell and commission manager.
- `visual/admin-legacy-reference.spec.ts`: captures legacy `/admin/*` reference screenshots from `apps/web` under the `admin-legacy` Playwright project.
- `visual/admin-suggestion.spec.ts`: standalone admin Playwright visual regression for the suggestion page.
- `visual/helpers.ts`: shared screenshot stabilization, clipping, and project-gating helpers for admin visual tests.

## Rules

- Keep standalone admin visual regression targeting `apps/admin`, not `apps/web`.
- Keep legacy reference capture in the dedicated `admin-legacy` Playwright project; do not mix those snapshots into ad hoc manual screenshots.
- When a standalone route is not fully migrated yet, preserve its legacy reference baseline here first and only enable direct standalone comparison after the page matches.
- When the create page shell, bootstrap fetch, or upload form contract changes, run `bun run test:visual`.
- When the edit page shell, manager search, drag ordering, source-image controls, or refresh button contract changes, run `bun run test:visual`.
- When the suggestion page shell or worker-backed bootstrap behavior changes, run `bun run test:visual`.
