# AGENTS

This directory contains repository-level developer workflow scripts.

## Tree

- `devAdminRemote.ts`: starts `apps/admin-worker`, waits until a binding-backed admin API endpoint is readable, then starts the standalone admin Vite app so local admin development mirrors the Worker deployment topology without a frontend startup race.

## Responsibilities

- Keep developer entrypoints aligned with the target deployment topology.
- Prefer fewer long-running processes when the worker can already own the backend state directly.

## Guardrails

- Orchestrator scripts should forward signals cleanly and exit non-zero when any child process fails.
- Do not reintroduce legacy `apps/web` as a default dependency for standalone admin development once worker-native routes exist.
