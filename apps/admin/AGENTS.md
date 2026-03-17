# AGENTS

This directory contains the standalone admin frontend app (`Vite + React`).

## Responsibilities

- Preserve the existing admin visual design, spacing rhythm, and typography.
- Reuse existing admin React components and interaction behavior without restyling.
- Talk only to the admin worker API via `ADMIN_API_BASE_URL`.

## Guardrails

- Do not redesign admin UI during migration.
- Keep top-level style contracts aligned with the legacy admin shell.
- Validate every migrated admin page with Playwright visual regression.
