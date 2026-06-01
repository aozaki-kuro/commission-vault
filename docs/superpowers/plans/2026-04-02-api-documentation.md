# API Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Write a complete, standalone API reference + AI Agent integration guide for the commission-index admin API so any AI agent (or new developer) can use it without reading source code.

**Architecture:** Two Markdown documents — one OpenAPI-style REST reference (`docs/api-reference.md`) covering every endpoint's method, path, request shape, response shape, and constraints; one AI Agent integration guide (`docs/ai-agent-guide.md`) covering implicit behaviors, normalization rules, serialization quirks, error handling, and workflow examples that are not obvious from the endpoint list alone. No code generation, no runtime changes — documentation only.

**Tech Stack:** Markdown, TypeScript type excerpts (copied from `packages/domain/src/` and `apps/admin-worker/src/adminApi.ts`), shell `curl` examples.

---

## Scope

Two independent documents:

| Document                 | Purpose                                                                                                                 |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `docs/api-reference.md`  | Complete endpoint reference — method, path, auth, request/response types, constraints, `curl` examples                  |
| `docs/ai-agent-guide.md` | Integration guide — implicit behaviors, serialization rules, normalization, retry strategy, workflow examples, pitfalls |

The project has no existing OpenAPI spec or integration guide. All API knowledge currently lives in `apps/admin-worker/src/adminApi.ts`, `adminData.ts`, `adminPersistence.ts`, `adminSourceImages.ts`, and `packages/domain/src/admin.ts`. The documents must capture everything an agent needs without requiring source code access.

---

## File Structure

```
docs/
├── api-reference.md          # Create: REST endpoint reference
└── ai-agent-guide.md         # Create: AI agent integration guide
```

No existing files are modified. No code changes.

---

## Task 1: REST API Reference Document

**Files:**

- Create: `docs/api-reference.md`

**Source material to read first:**

- `apps/admin-worker/src/index.ts` — CORS setup, routing
- `apps/admin-worker/src/adminApi.ts` — Route handlers, input types
- `apps/admin-worker/src/adminData.ts` — Read endpoint implementations
- `packages/domain/src/admin.ts` — DTO types
- `packages/domain/src/aliases.ts` — Alias types

- [ ] **Step 1: Read source files to verify all types before writing**

```bash
# Verify these files exist and read them
cat apps/admin-worker/src/adminApi.ts | head -100
cat packages/domain/src/admin.ts
cat packages/domain/src/aliases.ts
```

- [ ] **Step 2: Create `docs/api-reference.md`**

Create the file with this exact content:

````markdown
# Commission Index — Admin API Reference

**Base URL (production):** `https://admin.crystallize.cc`
**Base URL (local dev):** `http://127.0.0.1:8787`

**Auth:** All `/api/admin/*` endpoints are protected by Cloudflare Zero Trust at the network boundary. The worker itself performs no token validation — authenticated sessions pass through transparently. In local dev, CORS allows any `*.localhost` or `127.0.0.1:*` origin.

**Response envelope (mutations):**

```json
{ "status": "success" | "error", "message": "string" }
```
````

**Error format:** HTTP 400/404/500 + `{ "status": "error", "message": "..." }`.

---

## Health & System

### `GET /api/admin/health`

Worker liveness check. No auth required (Zero Trust is bypass-able for health probes if configured).

**Response `200`:**

```json
{ "status": "ok", "message": "Admin worker is healthy." }
```

**curl:**

```bash
curl https://admin.crystallize.cc/api/admin/health
```

---

### `POST /api/admin/rebuild`

Dispatches a GitHub Actions workflow to export D1/R2 data to the web app and redeploy.

**Request:** Empty body.

**Response `200`:**

```json
{ "status": "success", "message": "Rebuild triggered successfully." }
```

**Response `500`** (GitHub dispatch failed):

```json
{ "status": "error", "message": "Failed to trigger rebuild: ..." }
```

**curl:**

```bash
curl -X POST https://admin.crystallize.cc/api/admin/rebuild
```

---

## Bootstrap / Read Endpoints

### `GET /api/admin/bootstrap`

Load all data needed to render the admin UI — characters, creator aliases, and all commissions.

**Response `200`:**

```typescript
{
  characters: Array<{
    id: number
    name: string
    status: 'active' | 'archived'
    sortOrder: number
    commissionCount: number
  }>
  creatorAliases: Array<{
    creatorName: string // Extracted from commission fileName (YYYYMMDD_creator format)
    aliases: string[]
    commissionCount: number
  }>
  commissionSearchRows: Array<{
    id: number
    characterId: number
    characterName: string
    fileName: string // e.g. "20240315_artist"
    links: string[]
    design: string | null
    description: string | null
    keyword: string | null // Comma-separated terms
    hidden: boolean
  }>
}
```

**curl:**

```bash
curl https://admin.crystallize.cc/api/admin/bootstrap
```

---

### `GET /api/admin/aliases/bootstrap`

Load all alias tables with commission counts for the aliases admin page.

**Response `200`:**

```typescript
{
  characterAliases: Array<{
    characterName: string
    aliases: string[]
    commissionCount: number
  }>
  creatorAliases: Array<{
    creatorName: string
    aliases: string[]
    commissionCount: number
  }>
  keywordAliases: Array<{
    baseKeyword: string
    aliases: string[]
    commissionCount: number
  }>
}
```

**curl:**

```bash
curl https://admin.crystallize.cc/api/admin/aliases/bootstrap
```

---

### `GET /api/admin/suggestion`

Load home page featured search keywords and the pool of available keyword options.

**Response `200`:**

```typescript
{
  featuredKeywords: string[]   // Up to 6 user-curated keywords
  keywordOptions: string[]     // Up to 240 popular keywords derived from all commission metadata
}
```

**curl:**

```bash
curl https://admin.crystallize.cc/api/admin/suggestion
```

---

### `GET /api/admin/characters/:id/commissions`

Fetch all commissions belonging to a specific character.

**Path params:** `id` — character integer ID.

**Response `200`:**

```typescript
{
  commissions: Array<{
    id: number
    characterId: number
    characterName: string
    fileName: string
    links: string[]
    design: string | null
    description: string | null
    keyword: string | null
    hidden: boolean
  }>
}
```

**curl:**

```bash
curl https://admin.crystallize.cc/api/admin/characters/3/commissions
```

---

### `GET /api/admin/source-image/:fileName`

Fetch the raw source image for a commission. `fileName` is the commission's `fileName` field **without file extension**.

**Path params:** `fileName` — e.g. `20240315_artist`

**Response `200`:** Binary image data with `Content-Type: image/jpeg` or `image/png`.

**Response `404`:** `{ "status": "error", "message": "Source image not found." }`

**curl:**

```bash
curl https://admin.crystallize.cc/api/admin/source-image/20240315_artist -o out.jpg
```

---

## Character Mutations

### `POST /api/admin/characters`

Create a new character.

**Request body (JSON):**

```typescript
{
  name: string // Required. Display name.
  status: 'active' | 'archived' // Required.
}
```

**Response `200`:**

```json
{ "status": "success", "message": "Character created." }
```

**Response `400`** (validation):

```json
{ "status": "error", "message": "Character name is required." }
```

**curl:**

```bash
curl -X POST https://admin.crystallize.cc/api/admin/characters \
  -H "Content-Type: application/json" \
  -d '{"name":"Aiko","status":"active"}'
```

---

### `PATCH /api/admin/characters/:id`

Rename a character.

**Path params:** `id` — character integer ID.

**Request body (JSON):**

```typescript
{
  id: number
  name: string
  status: 'active' | 'archived'
}
```

**Response `200`:** `{ "status": "success", "message": "Character updated." }`

**curl:**

```bash
curl -X PATCH https://admin.crystallize.cc/api/admin/characters/3 \
  -H "Content-Type: application/json" \
  -d '{"id":3,"name":"Aiko Renamed","status":"active"}'
```

---

### `PUT /api/admin/characters/order`

Set the sort order of all characters. **You must send ALL character IDs** (both active and archived). Any ID omitted from the payload is removed from the sort order.

**Request body (JSON):**

```typescript
{
  active: number[]    // IDs of active characters in desired display order
  archived: number[]  // IDs of archived characters in desired display order
}
```

**Response `200`:** `{ "status": "success", "message": "Character order saved." }`

**curl:**

```bash
curl -X PUT https://admin.crystallize.cc/api/admin/characters/order \
  -H "Content-Type: application/json" \
  -d '{"active":[2,1,4],"archived":[3]}'
```

---

### `DELETE /api/admin/characters/:id`

Delete a character and all its commissions. Irreversible.

**Path params:** `id` — character integer ID.

**Response `200`:** `{ "status": "success", "message": "Character deleted." }`

**curl:**

```bash
curl -X DELETE https://admin.crystallize.cc/api/admin/characters/3
```

---

## Commission Mutations

### `POST /api/admin/commissions`

Create a new commission and upload its source image in one request.

**Request body (multipart/form-data):**

| Field         | Type                          | Required | Notes                                                                        |
| ------------- | ----------------------------- | -------- | ---------------------------------------------------------------------------- |
| `characterId` | string (number)               | Yes      | Target character ID                                                          |
| `fileName`    | string                        | Yes      | `YYYYMMDD` or `YYYYMMDD_creator`. No extension. Forbidden chars: `<>:"/\|?*` |
| `links`       | string (JSON array)           | Yes      | JSON-encoded string array, e.g. `'["https://...","https://..."]'`            |
| `design`      | string                        | No       | Optional label                                                               |
| `description` | string                        | No       | Optional description                                                         |
| `keyword`     | string                        | No       | Comma-separated keywords, e.g. `"portrait,color"`                            |
| `hidden`      | string (`"true"` / `"false"`) | Yes      | Whether hidden from public site                                              |
| `sourceImage` | File                          | Yes      | JPEG or PNG. Content-Type must be `image/jpeg` or `image/png`                |

**Response `200`:** `{ "status": "success", "message": "Commission created." }`

**Response `400`** (fileName conflict, validation, duplicate): `{ "status": "error", "message": "..." }`

**curl:**

```bash
curl -X POST https://admin.crystallize.cc/api/admin/commissions \
  -F "characterId=3" \
  -F "fileName=20240315_artist" \
  -F 'links=["https://x.com/example/status/123"]' \
  -F "design=outfit A" \
  -F "keyword=portrait,color" \
  -F "hidden=false" \
  -F "sourceImage=@/path/to/image.jpg;type=image/jpeg"
```

---

### `PATCH /api/admin/commissions/:id`

Update commission metadata. Does **not** replace the source image.

**Path params:** `id` — commission integer ID.

**Request body (JSON):**

```typescript
{
  characterId: number
  fileName: string          // If changed, R2 object is renamed (copy + delete)
  links: string[]           // String array (not JSON-encoded string)
  design?: string | null
  description?: string | null
  keyword?: string | null   // Comma-separated
  hidden: boolean
}
```

**Response `200`:** `{ "status": "success", "message": "Commission updated." }`

**curl:**

```bash
curl -X PATCH https://admin.crystallize.cc/api/admin/commissions/42 \
  -H "Content-Type: application/json" \
  -d '{"characterId":3,"fileName":"20240315_artist","links":["https://x.com/example/status/123"],"design":null,"description":null,"keyword":"portrait","hidden":false}'
```

---

### `DELETE /api/admin/commissions/:id`

Delete a commission and its source image from R2.

**Path params:** `id` — commission integer ID.

**Response `200`:** `{ "status": "success", "message": "Commission deleted." }`

**curl:**

```bash
curl -X DELETE https://admin.crystallize.cc/api/admin/commissions/42
```

---

### `POST /api/admin/commissions/:id/source-image`

Replace the source image for an existing commission.

**Path params:** `id` — commission integer ID.

**Request body (multipart/form-data):**

| Field                | Type   | Required | Notes                                              |
| -------------------- | ------ | -------- | -------------------------------------------------- |
| `commissionFileName` | string | Yes      | The commission's current `fileName` (no extension) |
| `sourceImage`        | File   | Yes      | JPEG or PNG                                        |

**Response `200`:** `{ "status": "success", "message": "Source image replaced." }`

**curl:**

```bash
curl -X POST https://admin.crystallize.cc/api/admin/commissions/42/source-image \
  -F "commissionFileName=20240315_artist" \
  -F "sourceImage=@/path/to/new.jpg;type=image/jpeg"
```

---

## Alias Mutations

All alias batch endpoints follow the same pattern: send a `rows` array and the worker replaces the entire alias table atomically.

### `POST /api/admin/aliases/batch`

Replace all creator aliases.

**Request body (JSON):**

```typescript
{
  rows: Array<{
    creatorName: string // Must match creator names extracted from commission fileNames
    aliases: string[] // Alternative search names for this creator
  }>
}
```

**Response `200`:** `{ "status": "success", "message": "Creator aliases saved." }`

**curl:**

```bash
curl -X POST https://admin.crystallize.cc/api/admin/aliases/batch \
  -H "Content-Type: application/json" \
  -d '{"rows":[{"creatorName":"artist","aliases":["@artist","Artist Name"]}]}'
```

---

### `POST /api/admin/character-aliases/batch`

Replace all character aliases.

**Request body (JSON):**

```typescript
{
  rows: Array<{
    characterName: string
    aliases: string[]
  }>
}
```

**Response `200`:** `{ "status": "success", "message": "Character aliases saved." }`

**curl:**

```bash
curl -X POST https://admin.crystallize.cc/api/admin/character-aliases/batch \
  -H "Content-Type: application/json" \
  -d '{"rows":[{"characterName":"Aiko","aliases":["あいこ","AI子"]}]}'
```

---

### `POST /api/admin/keyword-aliases/batch`

Replace all keyword aliases.

**Request body (JSON):**

```typescript
{
  rows: Array<{
    baseKeyword: string
    aliases: string[]
  }>
}
```

**Response `200`:** `{ "status": "success", "message": "Keyword aliases saved." }`

**curl:**

```bash
curl -X POST https://admin.crystallize.cc/api/admin/keyword-aliases/batch \
  -H "Content-Type: application/json" \
  -d '{"rows":[{"baseKeyword":"portrait","aliases":["bust","face shot"]}]}'
```

---

### `POST /api/admin/suggestion`

Save the home page featured search keywords (up to 6 shown in the UI).

**Request body (JSON):**

```typescript
{
  keywords: string[]   // Array of keyword strings. Order is preserved.
}
```

**Response `200`:** `{ "status": "success", "message": "Featured keywords saved." }`

**curl:**

```bash
curl -X POST https://admin.crystallize.cc/api/admin/suggestion \
  -H "Content-Type: application/json" \
  -d '{"keywords":["portrait","chibi","summer outfit"]}'
```

````

- [ ] **Step 3: Verify the file was created**

```bash
wc -l docs/api-reference.md
````

Expected: 350+ lines.

---

## Task 2: AI Agent Integration Guide

**Files:**

- Create: `docs/ai-agent-guide.md`

**Source material to read first (implicit behaviors not in Task 1):**

- `apps/admin-worker/src/adminSourceImages.ts` — File validation rules
- `apps/admin-worker/src/adminPersistence.ts` — Normalization on write
- `apps/admin/src/lib/adminApi.ts` — Retry/backoff logic
- `packages/domain/src/creatorAliases.ts` — Creator name normalization
- `packages/domain/src/keywordAliases.ts` — Keyword normalization

- [ ] **Step 1: Read the source files for implicit behaviors**

```bash
cat apps/admin-worker/src/adminSourceImages.ts
cat packages/domain/src/creatorAliases.ts | head -60
cat apps/admin/src/lib/adminApi.ts | head -80
```

- [ ] **Step 2: Create `docs/ai-agent-guide.md`**

Create the file with this exact content:

````markdown
# Commission Index — AI Agent Integration Guide

This guide covers the non-obvious behaviors, implicit contracts, and workflow patterns needed to safely automate the admin API. Read the [API Reference](./api-reference.md) first for endpoint signatures.

---

## Base URL Resolution

```typescript
// Dev: default to worker dev server
const base = import.meta.env.ADMIN_API_BASE_URL ?? 'http://127.0.0.1:8787'

// Production: same-origin (admin UI served from admin.crystallize.cc)
// Worker is at the same domain — no CORS required in production
```
````

Set `ADMIN_API_BASE_URL=https://admin.crystallize.cc` in any agent running outside the browser.

---

## Retry Strategy

The admin frontend uses this retry policy for all JSON requests:

```typescript
const MAX_ATTEMPTS = 4
const TIMEOUT_MS = 8_000

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(timer)
    if (res.ok) return await res.json()
    // Non-2xx: throw immediately (don't retry client errors)
    throw new Error(`HTTP ${res.status}`)
  } catch (err) {
    clearTimeout(timer)
    if (attempt === MAX_ATTEMPTS) throw err
    await new Promise(r => setTimeout(r, 250 * attempt)) // 250ms, 500ms, 750ms backoff
  }
}
```

**Rule:** Retry on network errors and timeouts. Do NOT retry on 4xx responses — those indicate bad input.

---

## File Name Format

Commission file names follow the pattern `YYYYMMDD_creator` (or just `YYYYMMDD` if no creator).

```
20240315_artist     ✅ date + underscore + creator handle
20240315            ✅ date only
20240315-artist     ❌ hyphen not underscore
artist_20240315     ❌ date must come first
20240315_my/art     ❌ slash is forbidden
```

**Forbidden characters in fileName:** `< > : " / \ | ? *` and ASCII control characters (≤ 0x1F). Path traversal sequences (`..`) are also rejected.

**Creator name extraction:** The part after the first `_` is treated as the creator handle. This is how the worker populates `creatorAliases`. If a commission fileName is `20240315_neko`, the creator name is `neko`.

**CJK creator names** are supported — the normalization function handles Unicode. Don't ASCII-escape Japanese/Chinese creator handles.

---

## Links Field Serialization

The `links` field has different serialization depending on context:

| Context                                                            | Format                                                   |
| ------------------------------------------------------------------ | -------------------------------------------------------- |
| API response (`GET /bootstrap`, `GET /characters/:id/commissions`) | `string[]` — array of URL strings                        |
| `PATCH /api/admin/commissions/:id` request body                    | `string[]` — same array                                  |
| `POST /api/admin/commissions` FormData                             | JSON-encoded string: `'["https://..."]'`                 |
| Admin form textarea                                                | Newline-delimited string (frontend joins/splits on `\n`) |

**Rule:** For `POST` (FormData), JSON-encode the array before appending. For `PATCH` (JSON), send the native array.

```typescript
// POST (FormData)
formData.append('links', JSON.stringify(['https://x.com/status/123', 'https://...']))

// PATCH (JSON body)
body = JSON.stringify({ ..., links: ['https://x.com/status/123', 'https://...'] })
```

---

## Keyword Field

The `keyword` column stores a comma-separated string of terms. No spaces around commas are required but they are stripped on normalization.

```
"portrait,color,chibi"   ✅
"portrait, color, chibi" ✅ (spaces stripped)
["portrait","color"]     ❌ Don't send JSON array — send plain string
```

When reading from `GET /bootstrap`, `keyword` is a raw comma-separated string (or `null`). Split on `,` to get individual terms.

---

## Alias Batch Semantics

Alias endpoints **replace the entire table** — they are not additive patches.

```typescript
// To add one alias to an existing creator:
// 1. GET /api/admin/aliases/bootstrap
// 2. Find the creator in the response
// 3. Append to their aliases array
// 4. POST /api/admin/aliases/batch with ALL rows including the modified one

// ❌ Wrong: posting only the changed row will delete all other aliases
await fetch('/api/admin/aliases/batch', {
  method: 'POST',
  body: JSON.stringify({ rows: [{ creatorName: 'neko', aliases: ['new alias'] }] }),
})

// ✅ Correct: include all existing rows
const existing = await fetch('/api/admin/aliases/bootstrap').then(r => r.json())
const updated = existing.creatorAliases.map(row =>
  row.creatorName === 'neko' ? { ...row, aliases: [...row.aliases, 'new alias'] } : row,
)
await fetch('/api/admin/aliases/batch', {
  method: 'POST',
  body: JSON.stringify({ rows: updated }),
})
```

---

## Character Order Update

`PUT /api/admin/characters/order` replaces sort order for **all** characters. Omitting an ID removes it from the order (it falls to the bottom).

**Safe pattern:**

```typescript
// 1. GET current characters from bootstrap
const { characters } = await fetch('/api/admin/bootstrap').then(r => r.json())

// 2. Split by status, reorder as needed
const active = characters.filter(c => c.status === 'active').sort(/* your order */)
const archived = characters.filter(c => c.status === 'archived').sort(/* your order */)

// 3. Send all IDs
await fetch('/api/admin/characters/order', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    active: active.map(c => c.id),
    archived: archived.map(c => c.id),
  }),
})
```

---

## Commission Create vs Update: Source Image

- `POST /api/admin/commissions` — creates commission + uploads image atomically (FormData)
- `PATCH /api/admin/commissions/:id` — updates metadata only; does NOT touch the image
- `POST /api/admin/commissions/:id/source-image` — replaces image only; does NOT touch metadata

**R2 consistency:** If `PATCH` changes `fileName`, the worker automatically:

1. Copies the R2 object from old key to new key
2. Updates the DB record
3. Deletes the old R2 object

You do not need to manually manage R2 objects — always go through the API.

---

## Source Image Constraints

| Constraint            | Rule                                                                          |
| --------------------- | ----------------------------------------------------------------------------- |
| MIME types            | `image/jpeg`, `image/png` only                                                |
| Content-Type header   | Must match actual format — worker validates                                   |
| Extensions            | `.jpg`, `.jpeg`, `.png` (auto-detected from MIME)                             |
| Duplicate fileName    | `POST` rejects if key already exists; `POST /:id/source-image` overwrites     |
| R2 cleanup on failure | If DB insert fails after image upload, the R2 object is deleted automatically |

---

## Keyword Normalization (Aliases)

When saving keyword aliases via `POST /api/admin/keyword-aliases/batch`, aliases are normalized before storage:

1. Split each alias string on commas
2. Trim whitespace from each term
3. Deduplicate within the alias list
4. Empty strings are dropped

```typescript
// Input
{ baseKeyword: 'portrait', aliases: ['bust, face shot', 'headshot', 'bust'] }

// Stored as (after normalization)
{ baseKeyword: 'portrait', aliases: ['bust', 'face shot', 'headshot'] }
```

---

## Bootstrap Load Strategy

For full admin UI initialization, load these in parallel:

```typescript
const [health, bootstrap, aliases, suggestion] = await Promise.all([
  fetch('/api/admin/health').then(r => r.json()),
  fetch('/api/admin/bootstrap').then(r => r.json()),
  fetch('/api/admin/aliases/bootstrap').then(r => r.json()),
  fetch('/api/admin/suggestion').then(r => r.json()),
])
```

If `health.status !== 'ok'`, abort — the worker is not available.

---

## Common Error Patterns

| Scenario                | HTTP | Body                                                                            |
| ----------------------- | ---- | ------------------------------------------------------------------------------- |
| Missing required field  | 400  | `{ status: 'error', message: 'Field X is required.' }`                          |
| Duplicate fileName      | 400  | `{ status: 'error', message: 'Commission with this fileName already exists.' }` |
| Character not found     | 404  | `{ status: 'error', message: 'Character not found.' }`                          |
| Commission not found    | 404  | `{ status: 'error', message: 'Commission not found.' }`                         |
| Image not found in R2   | 404  | `{ status: 'error', message: 'Source image not found.' }`                       |
| Worker bindings missing | 500  | `{ status: 'error', message: 'D1/R2 binding not configured.' }`                 |
| Unexpected exception    | 500  | `{ status: 'error', message: '...' }`                                           |

**Rule:** Check `response.status` and `body.status` — HTTP status alone is not sufficient since the worker may return a structured error in the body.

---

## Triggering a Rebuild

After making changes that should appear on the public site, call `POST /api/admin/rebuild`. This dispatches a GitHub Actions workflow that:

1. Exports D1/R2 data to `apps/web/generated/*`
2. Rebuilds the Astro static site
3. Redeploys to Cloudflare

There is no webhook or polling mechanism — the rebuild is fire-and-forget. Expect 2–5 minutes for the public site to reflect changes.

```typescript
const result = await fetch('/api/admin/rebuild', { method: 'POST' }).then(r => r.json())
if (result.status !== 'success') {
  console.error('Rebuild failed:', result.message)
}
```

---

## Dev Environment Quick Start

```bash
# 1. Start the worker (remote D1/R2, local dev mode)
pnpm run dev:admin   # starts worker at :8787 and admin UI at :4174

# 2. Verify worker is up
curl http://127.0.0.1:8787/api/admin/health
# → { "status": "ok", "message": "Admin worker is healthy." }

# 3. Load all admin data
curl http://127.0.0.1:8787/api/admin/bootstrap | jq '.characters | length'
```

No mock data — dev mode connects to real remote D1/R2 databases.

````

- [ ] **Step 3: Verify the file was created**

```bash
wc -l docs/ai-agent-guide.md
````

Expected: 280+ lines.

---

## Self-Review Checklist

After both files are written, verify:

- [ ] Every endpoint from `apps/admin-worker/src/adminApi.ts` appears in `api-reference.md`
- [ ] `links` serialization difference (FormData vs JSON) is explained in `ai-agent-guide.md`
- [ ] Alias batch replace-all semantics are documented with a before/after example
- [ ] Character order all-IDs-required rule is documented
- [ ] Source image MIME constraint is documented
- [ ] fileName format and forbidden characters are documented
- [ ] No "TBD" or placeholder text in either file
- [ ] All `curl` examples use real field names matching the actual API
