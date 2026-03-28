# admin/test

Visual regression suites for standalone admin.

## Rules

- Target `apps/admin`, not `apps/web`
- Legacy reference capture stays in `admin-legacy` Playwright project — don't mix snapshots
- Preserve legacy reference baseline until standalone page matches
- Run `bun run test:visual` when changing: create page shell, edit page shell, manager search, drag ordering, source-image controls, suggestion page, or refresh button
