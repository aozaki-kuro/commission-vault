# scripts

Repository-level developer workflow scripts.

## devAdminRemote.ts

Starts `apps/admin-worker`, waits until binding-backed admin API is readable, then starts standalone admin Vite app. Mirrors Worker deployment topology without frontend startup race.

- Forward signals cleanly; exit non-zero when any child fails
- Do not reintroduce `apps/web` as a dependency for standalone admin dev
