# Test AGENTS

## Tree

test/

- `setup.tsx`: Vitest DOM/global setup shared by React unit tests.
- `visual/icon-regression.spec.ts`: Playwright visual regression suite for home high-risk UI shells.

Repo root:

- `vitest.config.ts`: workspace-level Vitest entry that includes `apps/*` and `packages/*` tests while reusing this directory's setup helper.
- `playwright.config.ts`: workspace-level Playwright entry for visual regression, with runtime outputs under root `test-results/` and `playwright-report/`.
- `test/visual/apps/web/icon-regression.spec.ts-snapshots/*`: committed web Playwright baseline screenshots; update only for intentional visual changes.

## Rules

- Run `bun run test` for logic changes.
- Run `bun run test:visual` when touching search shell, sidebars, mobile floating menus, admin icon/layout hotspots, or snapshot files themselves.
- Use small, stable locator screenshots instead of full-page captures; avoid image-heavy full-page baselines.
- Before changing snapshots, verify the visual delta is intentional on both desktop and mobile states.
