# Test AGENTS

## Tree

- `visual/apps/web/icon-regression.spec.ts-snapshots/*`: committed Playwright baselines for the web visual suite.
- `visual/apps/admin/admin-legacy-reference.spec.ts-snapshots/*`: committed legacy `/admin/*` reference baselines captured from `apps/web`.
- `visual/apps/admin/admin-suggestion.spec.ts-snapshots/*`: committed Playwright baselines for the standalone admin visual suite.

## Rules

- Keep committed visual baselines under `test/visual/`.
- Treat legacy admin reference baselines as the visual source of truth for future `apps/admin` route migrations until each page is ported.
- Treat `playwright-report/` and `test-results/` as generated outputs; they should not replace baselines.
