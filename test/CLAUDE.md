# test

Committed Playwright baselines and generated test outputs.

- `visual/apps/web/` — web visual regression baselines
- `visual/apps/admin/` — admin visual regression baselines (including legacy reference)

## Rules

- Keep committed baselines under `test/visual/`
- Legacy admin reference baselines are the visual source of truth until each `apps/admin` route is ported
- `playwright-report/` and `test-results/` are generated — never replace baselines with these
