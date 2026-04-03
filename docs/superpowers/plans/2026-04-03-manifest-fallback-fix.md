# Manifest Fallback Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix silent hash-navigation failure when HTML is stale by adding a fresh-manifest fallback fetch for both timeline and character views.

**Architecture:** When the inline manifest (embedded in cached HTML) cannot resolve a hash target, fetch a standalone manifest JSON endpoint (built at Astro build time) with cache-busting. Use the fresh manifest's `targetBatchById` to locate the correct batch, then load and scroll. The happy path (inline manifest hit) is unchanged.

**Tech Stack:** Astro 6 static endpoints, TypeScript, Vitest

---

### File Structure

| Action | File                                                                            | Responsibility                                                 |
| ------ | ------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Create | `apps/web/src/pages/search/home-timeline-manifest.json.ts`                      | Astro endpoint outputting `HomeTimelineBatchManifest`          |
| Create | `apps/web/src/pages/search/home-character-manifest.json.ts`                     | Astro endpoint outputting `HomeCharacterBatchManifest`         |
| Modify | `apps/web/public/_headers`                                                      | Add `no-cache` rules for manifest endpoints                    |
| Modify | `apps/web/src/features/home/commission/batch/homeTimelineBatchManifest.ts`      | Add `fetchFreshHomeTimelineBatchManifest()`                    |
| Modify | `apps/web/src/features/home/commission/batch/homeCharacterBatchManifest.ts`     | Add `fetchFreshHomeCharacterBatchManifest()`                   |
| Modify | `apps/web/src/features/home/commission/batch/homeTimelineBatchClient.ts`        | Accept optional manifest override in `fetchHomeTimelineBatch`  |
| Modify | `apps/web/src/features/home/commission/batch/homeCharacterBatchClient.ts`       | Accept optional manifest override in `fetchHomeCharacterBatch` |
| Modify | `apps/web/src/features/home/commission/loader/timelineViewLoader.ts`            | Add fallback in `syncByMode` and `syncHashTarget`              |
| Modify | `apps/web/src/features/home/commission/loader/activeCharactersLoader.ts`        | Add fallback in `syncHashTarget`                               |
| Modify | `apps/web/src/features/home/commission/loader/archivedCharactersLoader.ts`      | Add fallback in `syncHashTarget`                               |
| Modify | `apps/web/src/features/home/commission/loader/timelineViewLoader.test.ts`       | Add fallback test cases                                        |
| Modify | `apps/web/src/features/home/commission/loader/activeCharactersLoader.test.ts`   | Add fallback test cases                                        |
| Modify | `apps/web/src/features/home/commission/loader/archivedCharactersLoader.test.ts` | Add fallback test cases                                        |

---

### Task 1: Standalone manifest Astro endpoints

**Files:**

- Create: `apps/web/src/pages/search/home-timeline-manifest.json.ts`
- Create: `apps/web/src/pages/search/home-character-manifest.json.ts`

- [ ] **Step 1: Create timeline manifest endpoint**

```ts
// apps/web/src/pages/search/home-timeline-manifest.json.ts
import type { APIRoute } from 'astro'
import { getCharacterAliases } from '@data/characterAliases'
import { getKeywordAliases } from '@data/keywordAliases'
import { normalizeHomeLocale } from '@features/home/i18n/homeLocale'
import {
  buildHomeTimelineBatchManifest,
  buildHomeTimelineBatchPlan,
} from '@features/home/server/homeTimelineBatches'
import { normalizeCharacterAliasKey } from '@lib/characterAliases'
import { buildSitePayload } from '@lib/home/buildSitePayload'
import { normalizeKeywordAliasKey } from '@lib/keywordAliases'
import { buildCreatorAliasesMap } from '@lib/sitePayload'
import { hashString } from '@lib/utils/hash'

export const GET: APIRoute = async () => {
  const locale = normalizeHomeLocale(undefined)
  const payload = buildSitePayload()
  const characterAliases = getCharacterAliases()
  const keywordAliases = getKeywordAliases()

  const characterAliasesMap = new Map(
    characterAliases
      .map(row => {
        const key = normalizeCharacterAliasKey(row.characterName)
        if (!key) return null
        return [key, row.aliases] as const
      })
      .filter((entry): entry is readonly [string, string[]] => Boolean(entry)),
  )
  const keywordAliasesMap = new Map(
    keywordAliases
      .map(row => {
        const key = normalizeKeywordAliasKey(row.baseKeyword)
        if (!key) return null
        return [key, row.aliases] as const
      })
      .filter((entry): entry is readonly [string, string[]] => Boolean(entry)),
  )
  const creatorAliasesMap = buildCreatorAliasesMap(payload.creatorAliases)

  const aliasContextHash = hashString(
    JSON.stringify([[...characterAliasesMap], [...creatorAliasesMap], [...keywordAliasesMap]]),
  )

  const plan = buildHomeTimelineBatchPlan({ groups: payload.timelineGroups })
  const manifest = buildHomeTimelineBatchManifest({
    contextHash: aliasContextHash,
    locale,
    plan,
  })

  return new Response(`${JSON.stringify(manifest)}\n`, {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}
```

- [ ] **Step 2: Create character manifest endpoint**

```ts
// apps/web/src/pages/search/home-character-manifest.json.ts
import type { APIRoute } from 'astro'
import { getCharacterAliases } from '@data/characterAliases'
import { getKeywordAliases } from '@data/keywordAliases'
import { normalizeHomeLocale } from '@features/home/i18n/homeLocale'
import {
  buildHomeCharacterBatchManifest,
  buildHomeCharacterBatchPlan,
} from '@features/home/server/homeCharacterBatches'
import { normalizeCharacterAliasKey } from '@lib/characterAliases'
import { buildSitePayload } from '@lib/home/buildSitePayload'
import { normalizeKeywordAliasKey } from '@lib/keywordAliases'
import { buildCommissionDataMap, buildCreatorAliasesMap } from '@lib/sitePayload'
import { hashString } from '@lib/utils/hash'

export const GET: APIRoute = async () => {
  const locale = normalizeHomeLocale(undefined)
  const payload = buildSitePayload()
  const commissionMap = buildCommissionDataMap(payload.commissionData)
  const characterAliases = getCharacterAliases()
  const keywordAliases = getKeywordAliases()

  const characterAliasesMap = new Map(
    characterAliases
      .map(row => {
        const key = normalizeCharacterAliasKey(row.characterName)
        if (!key) return null
        return [key, row.aliases] as const
      })
      .filter((entry): entry is readonly [string, string[]] => Boolean(entry)),
  )
  const keywordAliasesMap = new Map(
    keywordAliases
      .map(row => {
        const key = normalizeKeywordAliasKey(row.baseKeyword)
        if (!key) return null
        return [key, row.aliases] as const
      })
      .filter((entry): entry is readonly [string, string[]] => Boolean(entry)),
  )
  const creatorAliasesMap = buildCreatorAliasesMap(payload.creatorAliases)

  const aliasContextHash = hashString(
    JSON.stringify([[...characterAliasesMap], [...creatorAliasesMap], [...keywordAliasesMap]]),
  )

  const plan = buildHomeCharacterBatchPlan({
    activeChars: payload.characterStatus.active,
    archivedChars: payload.characterStatus.archived,
    commissionMap,
  })
  const manifest = buildHomeCharacterBatchManifest({
    commissionMap,
    contextHash: aliasContextHash,
    locale,
    plan,
  })

  return new Response(`${JSON.stringify(manifest)}\n`, {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}
```

- [ ] **Step 3: Add cache headers for manifest endpoints**

In `apps/web/public/_headers`, add before the `/_astro/*` rule:

```
/search/home-character-manifest.json
  Cache-Control: no-cache

/search/home-timeline-manifest.json
  Cache-Control: no-cache
```

- [ ] **Step 4: Verify build works**

Run: `bun run --cwd apps/web check:astro`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/search/home-timeline-manifest.json.ts apps/web/src/pages/search/home-character-manifest.json.ts apps/web/public/_headers
git commit -m "feat(web): add standalone manifest JSON endpoints for stale-HTML fallback"
```

---

### Task 2: Fresh manifest fetch functions

**Files:**

- Modify: `apps/web/src/features/home/commission/batch/homeTimelineBatchManifest.ts`
- Modify: `apps/web/src/features/home/commission/batch/homeCharacterBatchManifest.ts`

- [ ] **Step 1: Add `fetchFreshHomeTimelineBatchManifest` to `homeTimelineBatchManifest.ts`**

Add at the end of the file:

```ts
export async function fetchFreshHomeTimelineBatchManifest(): Promise<HomeTimelineBatchManifest | null> {
  try {
    const response = await fetch(`/search/home-timeline-manifest.json?_t=${Date.now()}`)
    if (!response.ok) return null
    return (await response.json()) as HomeTimelineBatchManifest
  } catch {
    return null
  }
}
```

- [ ] **Step 2: Add `fetchFreshHomeCharacterBatchManifest` to `homeCharacterBatchManifest.ts`**

Add at the end of the file:

```ts
export async function fetchFreshHomeCharacterBatchManifest(): Promise<HomeCharacterBatchManifest | null> {
  try {
    const response = await fetch(`/search/home-character-manifest.json?_t=${Date.now()}`)
    if (!response.ok) return null
    return (await response.json()) as HomeCharacterBatchManifest
  } catch {
    return null
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/home/commission/batch/homeTimelineBatchManifest.ts apps/web/src/features/home/commission/batch/homeCharacterBatchManifest.ts
git commit -m "feat(web): add fresh manifest fetch functions for stale-HTML fallback"
```

---

### Task 3: Accept manifest override in batch fetch functions

When loading a batch via a fresh manifest, the `batchVersions` must come from the fresh manifest (not the stale inline one). Add an optional `manifestOverride` parameter to `fetchHomeTimelineBatch` and `fetchHomeCharacterBatch`.

**Files:**

- Modify: `apps/web/src/features/home/commission/batch/homeTimelineBatchClient.ts`
- Modify: `apps/web/src/features/home/commission/batch/homeCharacterBatchClient.ts`

- [ ] **Step 1: Update `fetchHomeTimelineBatch` signature**

In `homeTimelineBatchClient.ts`, change the function to accept an optional `manifestOverride`:

```ts
export async function fetchHomeTimelineBatch({
  batchIndex,
  doc,
  manifestOverride,
}: {
  batchIndex: number
  doc: Document
  manifestOverride?: HomeTimelineBatchManifest | null
}) {
  const manifest = manifestOverride ?? readHomeTimelineBatchManifest(doc)
  if (!manifest) return null

  const url = buildHomeTimelineBatchUrl({
    batchIndex,
    locale: manifest.locale,
    v: manifest.batchVersions?.[batchIndex] ?? manifest.v,
  })

  let request = batchRequestCache.get(url)
  if (!request) {
    request = fetch(url)
      .then(async response => {
        if (!response.ok) {
          throw new Error(`Failed to load timeline batch ${batchIndex}: ${response.status}`)
        }

        return (await response.json()) as HomeTimelineBatchPayload
      })
      .catch(error => {
        batchRequestCache.delete(url)
        throw error
      })
    batchRequestCache.set(url, request)
  }

  return request
}
```

Add the `HomeTimelineBatchManifest` type import at the top:

```ts
import type { HomeTimelineBatchManifest } from '@features/home/server/homeTimelineBatches'
```

- [ ] **Step 2: Update `fetchHomeCharacterBatch` signature**

In `homeCharacterBatchClient.ts`, change the function to accept an optional `manifestOverride`:

```ts
export async function fetchHomeCharacterBatch({
  batchIndex,
  doc,
  status,
  manifestOverride,
}: {
  batchIndex: number
  doc: Document
  status: HomeCharacterBatchStatus
  manifestOverride?: HomeCharacterBatchManifest | null
}) {
  const manifest = manifestOverride ?? readHomeCharacterBatchManifest(doc)
  if (!manifest) return null

  const url = buildHomeCharacterBatchUrl({
    batchIndex,
    locale: manifest.locale,
    status,
    v: manifest[status].batchVersions?.[batchIndex] ?? manifest.v,
  })

  let request = batchRequestCache.get(url)
  if (!request) {
    request = fetch(url)
      .then(async response => {
        if (!response.ok) {
          throw new Error(`Failed to load ${status} batch ${batchIndex}: ${response.status}`)
        }

        return (await response.json()) as HomeCharacterBatchPayload
      })
      .catch(error => {
        batchRequestCache.delete(url)
        throw error
      })
    batchRequestCache.set(url, request)
  }

  return request
}
```

Add the `HomeCharacterBatchManifest` type import at the top:

```ts
import type { HomeCharacterBatchManifest } from '@features/home/server/homeCharacterBatches'
```

- [ ] **Step 3: Run tests to confirm no regressions**

Run: `bun run test -- --run apps/web/src/features/home/commission/batch/`
Expected: All existing tests pass (they don't pass `manifestOverride`, so it defaults to reading the inline manifest as before).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/home/commission/batch/homeTimelineBatchClient.ts apps/web/src/features/home/commission/batch/homeCharacterBatchClient.ts
git commit -m "feat(web): accept manifest override in batch fetch functions"
```

---

### Task 4: Add fallback to timeline view loader

**Files:**

- Modify: `apps/web/src/features/home/commission/loader/timelineViewLoader.ts`

The `loadBatchesThrough` function currently takes a `targetBatchIndex` and uses `fetchHomeTimelineBatch` without a manifest override. For the fallback path, we need a way to pass the fresh manifest through to the batch fetch. Add an optional `manifestOverride` parameter to `loadBatchesThrough` and thread it to `fetchHomeTimelineBatch`. Then modify `syncByMode` and `syncHashTarget` to try the fresh manifest when inline resolution fails.

- [ ] **Step 1: Thread `manifestOverride` through `loadBatchesThrough`**

Add `manifestOverride` as an optional parameter to `loadBatchesThrough` and pass it to `fetchHomeTimelineBatch`:

```ts
const loadBatchesThrough = async (
  targetBatchIndex: number,
  manifestOverride?: HomeTimelineBatchManifest | null,
) => {
  // ... existing setup unchanged ...

  for (let batchIndex = loadedBatchCount; batchIndex <= finalBatchIndex; batchIndex += 1) {
    queueBatchFetch(batchIndex + TIMELINE_BATCH_FETCH_CONCURRENCY - 1)

    const payload = await payloadRequests.get(batchIndex)
    if (payload) {
      mountHomeTimelineBatch({ container, payload })
    } else if (!mountLegacyHomeTimelineBatch({ batchIndex, container, panel: timelinePanel })) {
      break
    }

    loadedBatchCount = batchIndex + 1
    didChange = true
  }

  // ... rest unchanged ...
}
```

Where `queueBatchFetch` passes through `manifestOverride`:

```ts
const queueBatchFetch = (batchIndex: number) => {
  if (batchIndex > finalBatchIndex || payloadRequests.has(batchIndex)) return
  payloadRequests.set(batchIndex, fetchHomeTimelineBatch({ batchIndex, doc, manifestOverride }))
}
```

Add `queueLoad`'s `manifestOverride` support — add it to `RequestTimelineViewLoadOptions`:

In `timelineViewEvent.ts`, update `RequestTimelineViewLoadOptions`:

```ts
export interface RequestTimelineViewLoadOptions {
  strategy?: 'next' | 'all' | 'target'
  targetId?: string
  targetBatchCount?: number
  manifestOverride?: HomeTimelineBatchManifest | null
}
```

Add import for `HomeTimelineBatchManifest` from `@features/home/server/homeTimelineBatches` in `timelineViewEvent.ts`.

Then in `timelineViewLoader.ts`, thread it through `queueLoad`:

```ts
const queueLoad = (options: RequestTimelineViewLoadOptions = {}) => {
  const run = async () => {
    // ... existing code ...
    const didChange = await loadBatchesThrough(targetBatchIndex, options.manifestOverride)
    // ... rest unchanged ...
  }
  // ...
}
```

- [ ] **Step 2: Add fallback logic to `syncByMode`**

Import `fetchFreshHomeTimelineBatchManifest` and `normalizeBatchTargetId`. Change `syncByMode` from sync to async and add the fallback:

```ts
const syncByMode = async () => {
  const didSyncBefore = hasSyncedMode
  hasSyncedMode = true

  if (readCommissionViewMode(win) !== 'timeline') {
    stopAutoLoad()
    return
  }

  syncAutoLoad()

  if (!win.location.hash) return
  const hashTarget = getHashTarget(win.location.hash)
  if (hashTarget?.isConnected) {
    if (didSyncBefore) {
      deps.scrollToHashWithoutWrite(win.location.hash)
    }
    return
  }

  const hash = win.location.hash
  let targetBatchIndex = resolveDeferredTimelineBatch(doc, hash)

  if (targetBatchIndex === null) {
    const freshManifest = await fetchFreshHomeTimelineBatchManifest()
    const targetId = normalizeBatchTargetId(hash)
    if (!freshManifest || !targetId) return
    const freshIndex = freshManifest.targetBatchById[targetId]
    if (!Number.isInteger(freshIndex)) return
    targetBatchIndex = freshIndex

    void queueLoad({ strategy: 'target', targetId: hash, manifestOverride: freshManifest }).then(
      () => {
        win.requestAnimationFrame(() => {
          deps.scrollToHashWithoutWrite(hash)
        })
      },
    )
    return
  }

  void queueLoad({ strategy: 'target', targetId: hash }).then(() => {
    win.requestAnimationFrame(() => {
      deps.scrollToHashWithoutWrite(hash)
    })
  })
}
```

- [ ] **Step 3: Add fallback logic to `syncHashTarget`**

```ts
const syncHashTarget = async () => {
  if (readCommissionViewMode(win) !== 'timeline') return

  const hash = win.location.hash
  if (!hash) return
  const hashTarget = getHashTarget(hash)
  if (hashTarget?.isConnected) {
    win.requestAnimationFrame(() => {
      deps.scrollToHashWithoutWrite(hash)
      revealHashRestoreShell(win)
    })
    return
  }

  let targetBatchIndex = resolveDeferredTimelineBatch(doc, hash)
  let manifestOverride: HomeTimelineBatchManifest | null | undefined

  if (targetBatchIndex === null) {
    const freshManifest = await fetchFreshHomeTimelineBatchManifest()
    const targetId = normalizeBatchTargetId(hash)
    if (!freshManifest || !targetId) return
    const freshIndex = freshManifest.targetBatchById[targetId]
    if (!Number.isInteger(freshIndex)) return
    targetBatchIndex = freshIndex
    manifestOverride = freshManifest
  }

  void queueLoad({ strategy: 'target', targetId: hash, manifestOverride }).then(() => {
    win.requestAnimationFrame(() => {
      deps.scrollToHashWithoutWrite(hash)
      win.requestAnimationFrame(() => {
        revealHashRestoreShell(win)
      })
    })
  })
}
```

- [ ] **Step 4: Add imports**

In `timelineViewLoader.ts`, add:

```ts
import type { HomeTimelineBatchManifest } from '@features/home/server/homeTimelineBatches'
import { fetchFreshHomeTimelineBatchManifest } from '@features/home/commission/batch/homeTimelineBatchManifest'
import { normalizeBatchTargetId } from '@features/home/commission/batch/batchManifest'
```

- [ ] **Step 5: Run tests**

Run: `bun run test -- --run apps/web/src/features/home/commission/loader/timelineViewLoader.test.ts`
Expected: Existing tests pass (inline manifest still resolves; no fallback triggered).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/home/commission/loader/timelineViewLoader.ts apps/web/src/features/home/commission/loader/timelineViewEvent.ts
git commit -m "feat(web): add fresh-manifest fallback to timeline view hash navigation"
```

---

### Task 5: Add fallback to active characters loader

**Files:**

- Modify: `apps/web/src/features/home/commission/loader/activeCharactersLoader.ts`
- Modify: `apps/web/src/features/home/commission/loader/activeCharactersEvent.ts`

- [ ] **Step 1: Add `manifestOverride` to `RequestActiveCharactersLoadOptions`**

In `activeCharactersEvent.ts`:

```ts
import type { HomeCharacterBatchManifest } from '@features/home/server/homeCharacterBatches'

export interface RequestActiveCharactersLoadOptions {
  strategy?: 'next' | 'all' | 'target'
  targetId?: string
  targetBatchCount?: number
  manifestOverride?: HomeCharacterBatchManifest | null
}
```

- [ ] **Step 2: Thread `manifestOverride` through `activeCharactersLoader.ts`**

In `activeCharactersLoader.ts`, add imports:

```ts
import type { HomeCharacterBatchManifest } from '@features/home/server/homeCharacterBatches'
import { fetchFreshHomeCharacterBatchManifest } from '@features/home/commission/batch/homeCharacterBatchManifest'
import { normalizeBatchTargetId } from '@features/home/commission/batch/batchManifest'
```

Update `loadBatchesThrough` to accept and pass `manifestOverride`:

```ts
const loadBatchesThrough = async (
  targetBatchIndex: number,
  manifestOverride?: HomeCharacterBatchManifest | null,
) => {
  // ... existing setup ...

  const queueBatchFetch = (batchIndex: number) => {
    if (batchIndex > finalBatchIndex || payloadRequests.has(batchIndex)) return
    payloadRequests.set(
      batchIndex,
      fetchHomeCharacterBatch({ batchIndex, doc, status: 'active', manifestOverride }),
    )
  }

  // ... rest unchanged ...
}
```

Update `queueLoad` to thread `manifestOverride`:

```ts
const queueLoad = (options: RequestActiveCharactersLoadOptions = {}) => {
  const run = async () => {
    // ... existing code ...
    const didChange = await loadBatchesThrough(targetBatchIndex, options.manifestOverride)
    // ... rest unchanged ...
  }
  // ...
}
```

- [ ] **Step 3: Add fallback to `syncHashTarget`**

```ts
const syncHashTarget = async () => {
  const hash = win.location.hash
  if (!hash || isLocalLoaded()) return

  if (getHashTarget(hash)) {
    win.requestAnimationFrame(() => {
      deps.scrollToHashWithoutWrite(hash)
      revealHashRestoreShell(win)
    })
    return
  }

  let batchIndex = resolveDeferredActiveCharacterBatch(doc, hash)
  let manifestOverride: HomeCharacterBatchManifest | null | undefined

  if (batchIndex === null) {
    const freshManifest = await fetchFreshHomeCharacterBatchManifest()
    const targetId = normalizeBatchTargetId(hash)
    if (!freshManifest || !targetId) return
    const freshIndex = freshManifest.active.targetBatchById[targetId]
    if (!Number.isInteger(freshIndex)) return
    batchIndex = freshIndex
    manifestOverride = freshManifest
  }

  void queueLoad({ strategy: 'target', targetId: hash, manifestOverride }).then(() => {
    win.requestAnimationFrame(() => {
      deps.scrollToHashWithoutWrite(hash)
      win.requestAnimationFrame(() => {
        revealHashRestoreShell(win)
      })
    })
  })
}
```

- [ ] **Step 4: Run tests**

Run: `bun run test -- --run apps/web/src/features/home/commission/loader/activeCharactersLoader.test.ts`
Expected: Existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/home/commission/loader/activeCharactersLoader.ts apps/web/src/features/home/commission/loader/activeCharactersEvent.ts
git commit -m "feat(web): add fresh-manifest fallback to active characters hash navigation"
```

---

### Task 6: Add fallback to archived characters loader

**Files:**

- Modify: `apps/web/src/features/home/commission/loader/archivedCharactersLoader.ts`
- Modify: `apps/web/src/features/home/commission/loader/archivedCharactersEvent.ts`

- [ ] **Step 1: Add `manifestOverride` to `RequestArchivedCharactersLoadOptions`**

In `archivedCharactersEvent.ts`:

```ts
import type { HomeCharacterBatchManifest } from '@features/home/server/homeCharacterBatches'

export interface RequestArchivedCharactersLoadOptions {
  preserveScroll?: boolean
  strategy?: 'next' | 'all' | 'target'
  targetId?: string
  targetBatchCount?: number
  manifestOverride?: HomeCharacterBatchManifest | null
}
```

- [ ] **Step 2: Thread `manifestOverride` through `archivedCharactersLoader.ts`**

In `archivedCharactersLoader.ts`, add imports:

```ts
import type { HomeCharacterBatchManifest } from '@features/home/server/homeCharacterBatches'
import { fetchFreshHomeCharacterBatchManifest } from '@features/home/commission/batch/homeCharacterBatchManifest'
import { normalizeBatchTargetId } from '@features/home/commission/batch/batchManifest'
```

Update `loadBatchesThrough` to accept and pass `manifestOverride`:

```ts
const loadBatchesThrough = async (
  targetBatchIndex: number,
  manifestOverride?: HomeCharacterBatchManifest | null,
) => {
  // ... existing setup ...

  const queueBatchFetch = (batchIndex: number) => {
    if (batchIndex > finalBatchIndex || payloadRequests.has(batchIndex)) return
    payloadRequests.set(
      batchIndex,
      fetchHomeCharacterBatch({ batchIndex, doc, status: 'archived', manifestOverride }),
    )
  }

  // ... rest unchanged ...
}
```

Update `queueLoad` to thread `manifestOverride`:

```ts
const queueLoad = (options: RequestArchivedCharactersLoadOptions = {}) => {
  const run = async () => {
    // ... in the targetBatchIndex computation and loadBatchesThrough call ...
    const didChange = await loadBatchesThrough(targetBatchIndex, options.manifestOverride)
    // ... rest unchanged ...
  }
  // ...
}
```

- [ ] **Step 3: Add fallback to `syncHashTarget`**

```ts
const syncHashTarget = async () => {
  const hash = win.location.hash
  if (!hash) return

  if (getHashTarget(hash)) {
    win.requestAnimationFrame(() => {
      deps.scrollToHashWithoutWrite(hash)
      revealHashRestoreShell(win)
    })
    return
  }

  let batchIndex = resolveDeferredArchivedCharacterBatch(doc, hash)
  let manifestOverride: HomeCharacterBatchManifest | null | undefined

  if (batchIndex === null) {
    const freshManifest = await fetchFreshHomeCharacterBatchManifest()
    const targetId = normalizeBatchTargetId(hash)
    if (!freshManifest || !targetId) return
    const freshIndex = freshManifest.archived.targetBatchById[targetId]
    if (!Number.isInteger(freshIndex)) return
    batchIndex = freshIndex
    manifestOverride = freshManifest
  }

  void queueLoad({
    preserveScroll: false,
    strategy: 'target',
    targetId: hash,
    manifestOverride,
  }).then(() => {
    win.requestAnimationFrame(() => {
      deps.scrollToHashWithoutWrite(hash)
      win.requestAnimationFrame(() => {
        revealHashRestoreShell(win)
      })
    })
  })
}
```

- [ ] **Step 4: Run tests**

Run: `bun run test -- --run apps/web/src/features/home/commission/loader/archivedCharactersLoader.test.ts`
Expected: Existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/home/commission/loader/archivedCharactersLoader.ts apps/web/src/features/home/commission/loader/archivedCharactersEvent.ts
git commit -m "feat(web): add fresh-manifest fallback to archived characters hash navigation"
```

---

### Task 7: Add fallback test cases

Add tests verifying that when the inline manifest doesn't contain the target hash, the loader fetches a fresh manifest and successfully navigates.

**Files:**

- Modify: `apps/web/src/features/home/commission/loader/timelineViewLoader.test.ts`
- Modify: `apps/web/src/features/home/commission/loader/activeCharactersLoader.test.ts`
- Modify: `apps/web/src/features/home/commission/loader/archivedCharactersLoader.test.ts`

- [ ] **Step 1: Add timeline fallback test**

In `timelineViewLoader.test.ts`, add a test case that:

1. Renders a fixture where the inline manifest's `targetBatchById` does NOT contain the hash target
2. Mocks `fetch` to return a fresh manifest (with the target in `targetBatchById`) when `/search/home-timeline-manifest.json` is requested, and a valid batch payload when the batch URL is requested
3. Sets `window.location.hash` to the unknown target
4. Mounts the loader and fires `COMMISSION_VIEW_MODE_CHANGE_EVENT`
5. Asserts the batch was fetched and mounted, and scroll was called

```ts
describe('fresh manifest fallback', () => {
  it('fetches fresh manifest when inline manifest misses hash target', async () => {
    // Render fixture with inline manifest that only knows about batch 0 and 1
    renderFixture()
    const scrollSpy = vi.fn()

    // Set hash to an entry NOT in the inline manifest
    Object.defineProperty(window, 'location', {
      value: { ...window.location, hash: '#timeline-year-2023', search: '?view=timeline' },
      writable: true,
    })

    // Mock fetch to return fresh manifest and batch payload
    const freshManifest = {
      locale: 'en',
      v: 'fresh-v',
      batchVersions: ['bv0', 'bv1', 'bv2'],
      initialSectionIds: ['timeline-year-2026'],
      totalBatches: 3,
      targetBatchById: {
        'timeline-year-2025': 0,
        'timeline-year-2024': 1,
        'timeline-year-2023': 2,
      },
    }
    const batchPayload = createTimelineBatchPayload(2, '2023')

    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.startsWith('/search/home-timeline-manifest.json'))
          return Promise.resolve({ ok: true, json: () => Promise.resolve(freshManifest) })
        if (url.startsWith('/search/home-timeline-batches/'))
          return Promise.resolve({ ok: true, json: () => Promise.resolve(batchPayload) })
        return Promise.resolve({ ok: false, status: 404 })
      }),
    )

    const cleanup = mountTimelineViewLoader({
      deps: { scrollToHashWithoutWrite: scrollSpy },
    })

    // Trigger mode sync
    window.dispatchEvent(new Event(COMMISSION_VIEW_MODE_CHANGE_EVENT))

    await flushTimelineQueue()

    // Verify batch content was mounted
    const container = document.querySelector('[data-timeline-sections-container="true"]')
    expect(container?.querySelector('#character-alpha-20230101')).toBeTruthy()

    // Verify scroll was called with the hash
    expect(scrollSpy).toHaveBeenCalledWith('#timeline-year-2023')

    cleanup()
    vi.unstubAllGlobals()
  })
})
```

- [ ] **Step 2: Add active characters fallback test**

In `activeCharactersLoader.test.ts`, add an analogous test:

1. Inline manifest doesn't contain the target
2. Fresh manifest fetch returns the target in `active.targetBatchById`
3. Hash target is scrolled to after fallback

(Follow the same pattern as the timeline test, adapted for the active characters fixture and `homeCharacterBatchManifest` structure.)

- [ ] **Step 3: Add archived characters fallback test**

In `archivedCharactersLoader.test.ts`, add an analogous test:

1. Inline manifest doesn't contain the target
2. Fresh manifest fetch returns the target in `archived.targetBatchById`
3. Hash target is scrolled to after fallback

- [ ] **Step 4: Run all loader tests**

Run: `bun run test -- --run apps/web/src/features/home/commission/loader/`
Expected: All tests pass, including the new fallback tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/home/commission/loader/timelineViewLoader.test.ts apps/web/src/features/home/commission/loader/activeCharactersLoader.test.ts apps/web/src/features/home/commission/loader/archivedCharactersLoader.test.ts
git commit -m "test(web): add fresh-manifest fallback test cases for all loaders"
```

---

### Task 8: Final validation

- [ ] **Step 1: Run full lint**

Run: `bun run lint`
Expected: No errors.

- [ ] **Step 2: Run full typecheck**

Run: `bun run typecheck`
Expected: No errors.

- [ ] **Step 3: Run full test suite**

Run: `bun run test`
Expected: All tests pass.

- [ ] **Step 4: Update CLAUDE.md if needed**

If the new manifest endpoints change the data flow or caching semantics in a way that isn't covered by the existing docs, add a note to the "Home Page Architecture" section mentioning the fallback mechanism.
