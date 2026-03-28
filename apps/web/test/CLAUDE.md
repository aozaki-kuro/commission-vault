# web/test

- `setup.tsx` — Vitest DOM/global setup for React unit tests
- `visual/` — Playwright visual regression specs

## Rules

- Run `bun run test` for logic changes
- Run `bun run test:visual` when touching: search shell, sidebars, mobile floating menus, admin icon/layout, or snapshot files
- Use small, stable locator screenshots — avoid image-heavy full-page baselines
- Verify visual delta is intentional on both desktop and mobile before updating snapshots
