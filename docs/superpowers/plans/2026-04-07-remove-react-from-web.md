# Remove React from apps/web — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate React from `apps/web` by replacing the single search island with vanilla TS + Astro templates, achieving zero functional/visual/DOM-contract regression.

**Architecture:** Extract pure logic from React files into standalone modules. Build a lightweight event-driven store for state management. Render search UI as an Astro template with a vanilla TS controller that attaches behavior via `<script>`. Replace cmdk with native `<input>` + `<ul role="listbox">` + hand-written keyboard nav. Replace Radix popover with native `popover` attribute.

**Tech Stack:** Astro 6, vanilla TypeScript, Fuse.js (unchanged), native Popover API, Web Animations API

**Spec:** `docs/superpowers/specs/2026-04-07-remove-react-from-web-design.md`

---

## File Structure

### New files to create

| File                                                           | Responsibility                                                                                                            |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `src/features/home/search/CommissionSearchIsland.astro`        | Astro template — renders search HTML at build time (replaces `CommissionSearchDeferred.tsx` + `CommissionSearch.tsx` JSX) |
| `src/features/home/search/commissionSearchController.ts`       | Entry point — initializes on `requestIdleCallback`, binds events, wires modules together                                  |
| `src/features/home/search/commissionSearchStore.ts`            | Lightweight pub/sub state store (replaces React hooks state)                                                              |
| `src/features/home/search/commissionSearchKeyboard.ts`         | Keyboard navigation for suggestion listbox (replaces cmdk)                                                                |
| `src/features/home/search/commissionSearchDomSync.ts`          | DOM visibility sync — imperative API (extracted from `useCommissionSearchDomSync.ts`)                                     |
| `src/features/home/search/commissionSearchDeferred.ts`         | Deferred index loading, keyword rotation, shuffle logic (extracted from `CommissionSearchDeferred.tsx`)                   |
| `src/features/home/search/commissionSearchSuggestions.ts`      | Suggestion panel show/hide/dismiss + outside-click (replaces `useSuggestionPanelController.ts`)                           |
| `src/features/home/search/commissionSearchPanelState.ts`       | Panel loaded state via window events (replaces `useSearchPanelLoadedState.ts`)                                            |
| `src/features/home/search/commissionViewMode.ts`               | View mode subscribe/getSnapshot (replaces `CommissionViewMode.tsx`)                                                       |
| `src/features/home/search/commissionSearchModel.ts`            | Core search orchestration — index, matching, suggestions, analytics (replaces `useCommissionSearchModel.ts` hook logic)   |
| `src/features/home/search/commissionSearchDropdownRenderer.ts` | Renders suggestion dropdown items into DOM (replaces `CommissionSearchSuggestionDropdown.tsx`)                            |
| `src/features/home/search/commissionSearchHelpRenderer.ts`     | Renders help popover content into DOM (replaces `CommissionSearchHelpPopover.tsx`)                                        |

### Files unchanged

| File                                                       | Reason                         |
| ---------------------------------------------------------- | ------------------------------ |
| `src/features/home/search/commissionSearchIndex.ts`        | Pure TS, zero React dependency |
| `src/features/home/search/commissionSearchIndex.test.ts`   | Tests pure functions only      |
| `src/features/home/search/commissionSearchConstants.ts`    | Pure constant                  |
| `src/features/home/search/homeSearchControls.ts`           | Pure locale labels             |
| `src/features/home/search/homeSearchEntries.ts`            | Pure types                     |
| `src/features/home/commission/CommissionViewModeSearch.ts` | Pure parser                    |
| `src/features/home/commission/viewModeState.ts`            | Pure state reader              |

### Files to delete (Task 12)

All 11 React component/hook files, 6 UI library files, `astroReactServerShim.ts`, and 4 React test files. Full list in spec section 10.

### Existing test to migrate

| Current file                                                 | Action                                                                              |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `src/features/home/search/useCommissionSearchModel.test.ts`  | Rename to `commissionSearchModel.test.ts`, update imports (functions are identical) |
| `src/features/home/search/CommissionSearch.test.tsx`         | Delete — replaced by new tests                                                      |
| `src/features/home/search/PopularKeywordsRow.test.tsx`       | Delete — UI test, replaced by visual regression                                     |
| `src/features/home/search/CommissionSearchDeferred.test.tsx` | Delete — replaced by `commissionSearchDeferred.test.ts`                             |
| `src/features/home/commission/CommissionViewMode.test.tsx`   | Delete — replaced by `commissionViewMode.test.ts`                                   |

---

## Task 1: Extract pure logic from CommissionSearchDeferred.tsx

Extract all framework-agnostic functions from `CommissionSearchDeferred.tsx` into a standalone module. This is the foundation — later tasks import from here.

**Files:**

- Create: `apps/web/src/features/home/search/commissionSearchDeferred.ts`
- Create: `apps/web/src/features/home/search/commissionSearchDeferred.test.ts`
- Reference: `apps/web/src/features/home/search/CommissionSearchDeferred.tsx`

- [ ] **Step 1: Create `commissionSearchDeferred.ts` with extracted functions**

```ts
// apps/web/src/features/home/search/commissionSearchDeferred.ts
import type {
  CommissionSearchEntrySource,
  SearchSuggestionAliasGroup,
} from '@features/home/search/commissionSearchIndex'
import { readHomeCharacterBatchManifest } from '@features/home/commission/batch/homeCharacterBatchManifest'
import {
  ACTIVE_CHARACTERS_LOADED_EVENT,
  requestActiveCharactersLoad,
} from '@features/home/commission/loader/activeCharactersEvent'
import {
  ARCHIVED_CHARACTERS_LOADED_EVENT,
  requestArchivedCharactersLoad,
} from '@features/home/commission/loader/archivedCharactersEvent'
import {
  buildPopularKeywordPoolFromSuggestTexts,
  dedupeKeywords,
} from '@lib/search/popularKeywords'

export const MAX_FEATURED_KEYWORDS = 6
export const MAX_VISIBLE_POPULAR_KEYWORDS = 6
const COMMISSION_ENTRY_SELECTOR = '[data-commission-entry="true"]'
const SHUFFLE_DEFERRED_LOAD_TIMEOUT_MS = 8000
const ACTIVE_WEIGHT = 0.75

// ==================== Search index URL + caching ====================

export function buildHomeSearchIndexUrl() {
  const manifest = readHomeCharacterBatchManifest(
    typeof document !== 'undefined' ? document : undefined,
  )
  const v = manifest?.v
  return v ? `/search/home-search-entries.json?v=${v}` : '/search/home-search-entries.json'
}

let cachedHomeSearchEntries: CommissionSearchEntrySource[] | null = null
let homeSearchEntriesPromise: Promise<CommissionSearchEntrySource[]> | null = null

export function getCachedHomeSearchEntries() {
  return cachedHomeSearchEntries
}

export function ensureHomeSearchEntriesPromise() {
  if (cachedHomeSearchEntries) {
    return Promise.resolve(cachedHomeSearchEntries)
  }

  if (!homeSearchEntriesPromise) {
    homeSearchEntriesPromise = fetch(buildHomeSearchIndexUrl())
      .then(async response => {
        if (!response.ok) {
          throw new Error(`Failed to load search index: ${response.status}`)
        }
        return (await response.json()) as CommissionSearchEntrySource[]
      })
      .then(entries => {
        cachedHomeSearchEntries = entries
        return entries
      })
      .catch(error => {
        homeSearchEntriesPromise = null
        throw error
      })
  }

  return homeSearchEntriesPromise
}

// ==================== Seeded random ====================

export function createSeededRandom(seed: number) {
  let state = seed >>> 0 || 0x6d2b79f5

  return () => {
    state += 0x6d2b79f5
    let mixed = Math.imul(state ^ (state >>> 15), state | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffleKeywords(keywords: string[], seed: number) {
  const shuffled = [...keywords]
  const random = createSeededRandom(seed)

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    const current = shuffled[index]
    shuffled[index] = shuffled[swapIndex]
    shuffled[swapIndex] = current
  }

  return shuffled
}

export function getPopularKeywordBatch(keywords: string[], page: number, batchSize: number) {
  if (keywords.length <= batchSize) return keywords

  const seed = (keywords.length * 2654435761 + (page + 1) * 1013904223) >>> 0
  return shuffleKeywords(keywords, seed).slice(0, batchSize)
}

// ==================== Alias collapsing ====================

const normalizeKeywordVariantKey = (value: string) => value.trim().toLowerCase()

function buildAliasKeyLookup(aliasGroups: SearchSuggestionAliasGroup[]) {
  const keyToGroup = new Map<string, string>()

  for (const group of aliasGroups) {
    const normalizedTerms = [
      ...[group.term, ...group.aliases]
        .map(term => normalizeKeywordVariantKey(term))
        .filter((term): term is string => Boolean(term)),
    ]

    const uniqueTerms = [...new Set(normalizedTerms)]
    if (uniqueTerms.length < 2) continue

    const existingGroup = uniqueTerms.map(term => keyToGroup.get(term)).find(Boolean)
    const groupKey = existingGroup ?? uniqueTerms[0]

    for (const term of uniqueTerms) {
      keyToGroup.set(term, groupKey)
    }
  }

  return keyToGroup
}

export function collapseAliasKeywordVariants(
  keywords: string[],
  aliasGroups: SearchSuggestionAliasGroup[],
  seed: number,
) {
  if (keywords.length === 0 || aliasGroups.length === 0) return keywords

  const aliasKeyLookup = buildAliasKeyLookup(aliasGroups)
  if (aliasKeyLookup.size === 0) return keywords

  const candidatesByGroup = new Map<string, string[]>()
  const seenCandidateKeysByGroup = new Map<string, Set<string>>()

  for (const keyword of keywords) {
    const normalizedKeyword = normalizeKeywordVariantKey(keyword)
    if (!normalizedKeyword) continue
    const groupKey = aliasKeyLookup.get(normalizedKeyword)
    if (!groupKey) continue

    let seenKeys = seenCandidateKeysByGroup.get(groupKey)
    if (!seenKeys) {
      seenKeys = new Set<string>()
      seenCandidateKeysByGroup.set(groupKey, seenKeys)
    }
    if (seenKeys.has(normalizedKeyword)) continue
    seenKeys.add(normalizedKeyword)

    const candidates = candidatesByGroup.get(groupKey) ?? []
    candidates.push(keyword.trim())
    candidatesByGroup.set(groupKey, candidates)
  }

  const selectedTermByGroup = new Map<string, string>()
  const random = createSeededRandom(seed ^ candidatesByGroup.size)
  for (const [groupKey, candidates] of candidatesByGroup) {
    if (candidates.length === 0) continue
    if (candidates.length === 1) {
      selectedTermByGroup.set(groupKey, candidates[0])
      continue
    }

    const selectedIndex = Math.floor(random() * candidates.length)
    selectedTermByGroup.set(groupKey, candidates[selectedIndex])
  }

  const collapsedKeywords: string[] = []
  const emittedAliasGroups = new Set<string>()
  const emittedKeywordKeys = new Set<string>()

  for (const keyword of keywords) {
    const normalizedKeyword = normalizeKeywordVariantKey(keyword)
    if (!normalizedKeyword) continue

    const groupKey = aliasKeyLookup.get(normalizedKeyword)
    if (!groupKey) {
      if (emittedKeywordKeys.has(normalizedKeyword)) continue
      emittedKeywordKeys.add(normalizedKeyword)
      collapsedKeywords.push(keyword.trim())
      continue
    }
    if (emittedAliasGroups.has(groupKey)) continue

    emittedAliasGroups.add(groupKey)
    const selectedTerm = selectedTermByGroup.get(groupKey) ?? keyword.trim()
    const selectedTermKey = normalizeKeywordVariantKey(selectedTerm)
    if (!selectedTermKey || emittedKeywordKeys.has(selectedTermKey)) continue

    emittedKeywordKeys.add(selectedTermKey)
    collapsedKeywords.push(selectedTerm)
  }

  return collapsedKeywords
}

// ==================== DOM entry collection ====================

function collectSearchEntryElementsFromNode(root: ParentNode): HTMLElement[] {
  const directEntries = [...root.querySelectorAll<HTMLElement>(COMMISSION_ENTRY_SELECTOR)]
  const nestedTemplateEntries = [...root.querySelectorAll<HTMLTemplateElement>('template')].flatMap(
    template => collectSearchEntryElementsFromNode(template.content),
  )

  return [...directEntries, ...nestedTemplateEntries]
}

export function buildSearchEntriesFromDom(): CommissionSearchEntrySource[] {
  if (typeof document === 'undefined') return []

  const entriesByKey = new Map<string, Omit<CommissionSearchEntrySource, 'id'>>()
  collectSearchEntryElementsFromNode(document).forEach(element => {
    const domKey = element.dataset.commissionSearchKey
    const searchText = element.dataset.searchText
    if (!domKey || !searchText || entriesByKey.has(domKey)) return

    entriesByKey.set(domKey, {
      domKey,
      searchText,
      searchSuggest: element.dataset.searchSuggest,
    })
  })

  return Array.from(entriesByKey.values(), (entry, id) => ({
    id,
    ...entry,
  }))
}

export function buildPopularKeywordPoolFromEntries(entries: CommissionSearchEntrySource[]) {
  return buildPopularKeywordPoolFromSuggestTexts(
    entries
      .map(entry => entry.searchSuggest ?? '')
      .filter((suggestText): suggestText is string => Boolean(suggestText)),
  )
}

// ==================== Shuffle / surprise-me ====================

function cryptoRandomIndex(length: number) {
  try {
    const buf = new Uint32Array(1)
    crypto.getRandomValues(buf)
    return buf[0] % length
  } catch {
    return Math.floor(Math.random() * length)
  }
}

function extractSectionIdFromDomKey(domKey: string) {
  const separatorIndex = domKey.indexOf('::')
  return separatorIndex > 0 ? domKey.slice(0, separatorIndex) : ''
}

export function pickWeightedEntry<T extends CommissionSearchEntrySource>(pool: T[]): T {
  const manifest = readHomeCharacterBatchManifest(document)
  if (!manifest || pool.length <= 1) return pool[cryptoRandomIndex(pool.length)]

  const activeInitial = new Set(manifest.active.initialSectionIds)
  const activeDeferred = manifest.active.targetBatchById
  const active: T[] = []
  const rest: T[] = []

  for (const entry of pool) {
    const sectionId = extractSectionIdFromDomKey(entry.domKey)
    if (sectionId && (activeInitial.has(sectionId) || sectionId in activeDeferred))
      active.push(entry)
    else rest.push(entry)
  }

  if (active.length === 0) return rest[cryptoRandomIndex(rest.length)]
  if (rest.length === 0) return active[cryptoRandomIndex(active.length)]

  const pickActive = cryptoRandomIndex(100) < ACTIVE_WEIGHT * 100
  const chosen = pickActive ? active : rest
  return chosen[cryptoRandomIndex(chosen.length)]
}

export function loadDeferredEntryBatch(sectionId: string): Promise<void> {
  const manifest = readHomeCharacterBatchManifest(document)
  if (!manifest) return Promise.reject(new Error('No batch manifest'))

  const isActive = sectionId in manifest.active.targetBatchById
  const isArchived = !isActive && sectionId in manifest.archived.targetBatchById
  if (!isActive && !isArchived) return Promise.reject(new Error('Section not found in manifest'))

  const loadedEvent = isActive ? ACTIVE_CHARACTERS_LOADED_EVENT : ARCHIVED_CHARACTERS_LOADED_EVENT

  return new Promise<void>((resolve, reject) => {
    let settled = false
    let timeoutId: number

    const onLoaded = () => {
      if (settled) return
      settled = true
      window.clearTimeout(timeoutId)
      window.removeEventListener(loadedEvent, onLoaded)
      resolve()
    }

    timeoutId = window.setTimeout(() => {
      if (settled) return
      settled = true
      window.removeEventListener(loadedEvent, onLoaded)
      reject(new Error('Deferred load timeout'))
    }, SHUFFLE_DEFERRED_LOAD_TIMEOUT_MS)

    window.addEventListener(loadedEvent, onLoaded)

    if (isActive) {
      requestActiveCharactersLoad(window, {
        strategy: 'target',
        targetId: sectionId,
      })
    } else {
      requestArchivedCharactersLoad(window, {
        strategy: 'target',
        targetId: sectionId,
      })
    }
  })
}

export function scrollAndAnimateEntry(element: HTMLElement) {
  element.scrollIntoView({ behavior: 'smooth', block: 'center' })
  element.animate(
    [
      { boxShadow: '0 0 0 3px rgba(107,114,128,0.5)' },
      { boxShadow: '0 0 0 12px rgba(107,114,128,0)' },
    ],
    { duration: 1100, easing: 'ease-out' },
  )
}

// Re-export for consumers
export { dedupeKeywords }
```

- [ ] **Step 2: Write tests for the extracted pure functions**

```ts
// apps/web/src/features/home/search/commissionSearchDeferred.test.ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  collapseAliasKeywordVariants,
  createSeededRandom,
  getPopularKeywordBatch,
  shuffleKeywords,
} from './commissionSearchDeferred'

describe('createSeededRandom', () => {
  it('produces deterministic output for same seed', () => {
    const a = createSeededRandom(42)
    const b = createSeededRandom(42)
    expect(a()).toBe(b())
    expect(a()).toBe(b())
  })

  it('produces different output for different seeds', () => {
    const a = createSeededRandom(1)
    const b = createSeededRandom(2)
    expect(a()).not.toBe(b())
  })
})

describe('shuffleKeywords', () => {
  it('returns same-length array', () => {
    const result = shuffleKeywords(['a', 'b', 'c'], 42)
    expect(result).toHaveLength(3)
  })

  it('is deterministic for same seed', () => {
    const a = shuffleKeywords(['a', 'b', 'c', 'd', 'e'], 42)
    const b = shuffleKeywords(['a', 'b', 'c', 'd', 'e'], 42)
    expect(a).toEqual(b)
  })
})

describe('getPopularKeywordBatch', () => {
  it('returns all keywords when pool is smaller than batch size', () => {
    const result = getPopularKeywordBatch(['a', 'b'], 0, 6)
    expect(result).toEqual(['a', 'b'])
  })

  it('returns batch-size subset when pool is larger', () => {
    const keywords = Array.from({ length: 20 }, (_, i) => `kw${i}`)
    const result = getPopularKeywordBatch(keywords, 0, 6)
    expect(result).toHaveLength(6)
  })
})

describe('collapseAliasKeywordVariants', () => {
  it('returns keywords unchanged when no alias groups', () => {
    const result = collapseAliasKeywordVariants(['a', 'b'], [], 0)
    expect(result).toEqual(['a', 'b'])
  })

  it('collapses alias variants into one representative', () => {
    const keywords = ['Blue Hair', 'blue hair', 'Silver']
    const aliasGroups = [{ term: 'Blue Hair', aliases: ['blue hair'] }]
    const result = collapseAliasKeywordVariants(keywords, aliasGroups, 42)
    // Should have only one blue-hair variant + Silver
    expect(result).toHaveLength(2)
    expect(result).toContain('Silver')
  })
})
```

- [ ] **Step 3: Run the test to verify it passes**

Run: `cd apps/web && bunx vitest run src/features/home/search/commissionSearchDeferred.test.ts`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/home/search/commissionSearchDeferred.ts apps/web/src/features/home/search/commissionSearchDeferred.test.ts
git commit -m "refactor(search): extract pure logic from CommissionSearchDeferred into standalone module"
```

---

## Task 2: Create vanilla view mode store

Replace `CommissionViewMode.tsx` (React `useSyncExternalStore`) with a vanilla subscribe/getSnapshot pattern.

**Files:**

- Create: `apps/web/src/features/home/search/commissionViewMode.ts`
- Create: `apps/web/src/features/home/search/commissionViewMode.test.ts`
- Reference: `apps/web/src/features/home/commission/CommissionViewMode.tsx`
- Reference: `apps/web/src/features/home/commission/viewModeState.ts`

- [ ] **Step 1: Create `commissionViewMode.ts`**

```ts
// apps/web/src/features/home/search/commissionViewMode.ts
import type { CommissionViewMode } from '@features/home/commission/CommissionViewModeSearch'
import { COMMISSION_VIEW_MODE_CHANGE_EVENT } from '@features/home/events'
import { readCommissionViewMode } from '@features/home/commission/viewModeState'

export type { CommissionViewMode } from '@features/home/commission/CommissionViewModeSearch'

type Listener = (mode: CommissionViewMode) => void

const listeners = new Set<Listener>()

function getSnapshot(): CommissionViewMode {
  return typeof window === 'undefined' ? 'character' : readCommissionViewMode(window)
}

function notify() {
  const mode = getSnapshot()
  for (const fn of listeners) fn(mode)
}

let subscribed = false

function ensureWindowListeners() {
  if (subscribed || typeof window === 'undefined') return
  subscribed = true
  window.addEventListener('popstate', notify)
  window.addEventListener(COMMISSION_VIEW_MODE_CHANGE_EVENT, notify)
}

export function subscribeViewMode(fn: Listener): () => void {
  ensureWindowListeners()
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function readViewMode(): CommissionViewMode {
  return getSnapshot()
}
```

- [ ] **Step 2: Write test**

```ts
// apps/web/src/features/home/search/commissionViewMode.test.ts
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { readViewMode, subscribeViewMode } from './commissionViewMode'

describe('commissionViewMode', () => {
  it('returns character as default mode', () => {
    expect(readViewMode()).toBe('character')
  })

  it('notifies listeners on view mode change event', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeViewMode(listener)

    window.dispatchEvent(new Event('home:commission-view-mode-change'))
    expect(listener).toHaveBeenCalledWith('character')

    unsubscribe()
  })
})
```

- [ ] **Step 3: Run test**

Run: `cd apps/web && bunx vitest run src/features/home/search/commissionViewMode.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/home/search/commissionViewMode.ts apps/web/src/features/home/search/commissionViewMode.test.ts
git commit -m "refactor(search): create vanilla view mode store replacing React hook"
```

---

## Task 3: Create vanilla panel loaded state listener

Replace `useSearchPanelLoadedState.ts` with a vanilla event-driven module.

**Files:**

- Create: `apps/web/src/features/home/search/commissionSearchPanelState.ts`
- Reference: `apps/web/src/features/home/search/useSearchPanelLoadedState.ts`

- [ ] **Step 1: Create `commissionSearchPanelState.ts`**

The pure snapshot-reading functions from `useSearchPanelLoadedState.ts` are already framework-agnostic. Extract them and add a vanilla listener pattern.

```ts
// apps/web/src/features/home/search/commissionSearchPanelState.ts
import {
  ACTIVE_CHARACTERS_LOADED_EVENT,
  readActiveCharactersLoadedBatchCount,
  readActiveCharactersLoadedState,
} from '@features/home/commission/loader/activeCharactersEvent'
import {
  ARCHIVED_CHARACTERS_COLLAPSED_EVENT,
  ARCHIVED_CHARACTERS_LOADED_EVENT,
  ARCHIVED_CHARACTERS_STATE_CHANGE_EVENT,
  readArchivedCharactersLoadedBatchCount,
  readArchivedCharactersState,
} from '@features/home/commission/loader/archivedCharactersEvent'
import { TIMELINE_VIEW_LOADED_EVENT } from '@features/home/commission/loader/timelineViewLoader'

export interface PanelLoadedState {
  activeLoaded: boolean
  activeBatchCount: number
  archivedLoaded: boolean
  archivedVisible: boolean
  archivedBatchCount: number
  timelineLoaded: boolean
}

function readActiveSnapshot() {
  return {
    loaded: readActiveCharactersLoadedState(),
    batchCount: readActiveCharactersLoadedBatchCount(),
  }
}

function readArchivedSnapshot() {
  const state = readArchivedCharactersState()
  return {
    loaded: state.loaded,
    visible: state.visibility === 'visible',
    batchCount: readArchivedCharactersLoadedBatchCount(),
  }
}

function getTimelinePanelLoaded() {
  if (typeof document === 'undefined') return false
  return (
    document.querySelector<HTMLElement>('[data-commission-view-panel="timeline"]')?.dataset
      .timelineLoaded === 'true'
  )
}

export function readPanelLoadedState(): PanelLoadedState {
  const active = readActiveSnapshot()
  const archived = readArchivedSnapshot()
  return {
    activeLoaded: active.loaded,
    activeBatchCount: active.batchCount,
    archivedLoaded: archived.loaded,
    archivedVisible: archived.visible,
    archivedBatchCount: archived.batchCount,
    timelineLoaded: getTimelinePanelLoaded(),
  }
}

type PanelStateListener = (state: PanelLoadedState) => void
const listeners = new Set<PanelStateListener>()
let teardown: (() => void) | null = null

function notify() {
  const state = readPanelLoadedState()
  for (const fn of listeners) fn(state)
}

function ensureListeners() {
  if (teardown || typeof window === 'undefined') return

  const syncActive = () => notify()
  const syncArchived = () => notify()
  const syncTimeline = () => notify()

  window.addEventListener(ACTIVE_CHARACTERS_LOADED_EVENT, syncActive)
  window.addEventListener(ARCHIVED_CHARACTERS_STATE_CHANGE_EVENT, syncArchived)
  window.addEventListener(ARCHIVED_CHARACTERS_LOADED_EVENT, syncArchived)
  window.addEventListener(ARCHIVED_CHARACTERS_COLLAPSED_EVENT, syncArchived)
  window.addEventListener(TIMELINE_VIEW_LOADED_EVENT, syncTimeline)

  teardown = () => {
    window.removeEventListener(ACTIVE_CHARACTERS_LOADED_EVENT, syncActive)
    window.removeEventListener(ARCHIVED_CHARACTERS_STATE_CHANGE_EVENT, syncArchived)
    window.removeEventListener(ARCHIVED_CHARACTERS_LOADED_EVENT, syncArchived)
    window.removeEventListener(ARCHIVED_CHARACTERS_COLLAPSED_EVENT, syncArchived)
    window.removeEventListener(TIMELINE_VIEW_LOADED_EVENT, syncTimeline)
  }
}

export function subscribePanelState(fn: PanelStateListener): () => void {
  ensureListeners()
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
    if (listeners.size === 0 && teardown) {
      teardown()
      teardown = null
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/home/search/commissionSearchPanelState.ts
git commit -m "refactor(search): create vanilla panel loaded state listener"
```

---

## Task 4: Create vanilla DOM sync module

Extract the pure DOM sync functions from `useCommissionSearchDomSync.ts` into an imperative module that can be called when state changes.

**Files:**

- Create: `apps/web/src/features/home/search/commissionSearchDomSync.ts`
- Reference: `apps/web/src/features/home/search/useCommissionSearchDomSync.ts`

- [ ] **Step 1: Create `commissionSearchDomSync.ts`**

The pure functions (`areSetsEqual`, `toggleHiddenClass`, `syncEntryVisibility*`, `syncSectionVisibility`, `syncArchivedDividerVisibility`) are copied verbatim. The `useEffect` orchestration becomes an imperative `syncDom()` function.

```ts
// apps/web/src/features/home/search/commissionSearchDomSync.ts
import type { SearchIndex } from '@features/home/search/commissionSearchIndex'
import { dispatchSidebarSearchState } from '@lib/navigation/sidebarSearchState'

// ==================== Pure helpers (unchanged from useCommissionSearchDomSync) ====================

function areSetsEqual<T>(left: Set<T>, right: Set<T>) {
  if (left === right) return true
  if (left.size !== right.size) return false

  for (const value of left) {
    if (!right.has(value)) return false
  }

  return true
}

function setTextContentIfChanged(element: HTMLElement | null, message: string) {
  if (!element || element.textContent === message) return
  element.textContent = message
}

function toggleHiddenClass(element: HTMLElement, shouldHide: boolean) {
  const isHidden = element.classList.contains('hidden')
  if (isHidden === shouldHide) return false
  element.classList.toggle('hidden', shouldHide)
  return true
}

function syncEntryVisibilityForIndexChange({
  entryById,
  matchedIds,
  hasDeferredQuery,
  visibleSectionIds,
}: {
  entryById: SearchIndex['entryById']
  matchedIds: Set<number>
  hasDeferredQuery: boolean
  visibleSectionIds: Set<string> | null
}) {
  let didLayoutChange = false

  for (const entry of entryById.values()) {
    const isMatched = !hasDeferredQuery || matchedIds.has(entry.id)

    if (isMatched && visibleSectionIds && entry.sectionId) {
      visibleSectionIds.add(entry.sectionId)
    }

    if (!entry.element) continue
    if (toggleHiddenClass(entry.element, !isMatched)) {
      didLayoutChange = true
    }
  }

  return didLayoutChange
}

function syncEntryVisibilityForMatchedDiff({
  entryById,
  matchedIds,
  previousMatchedIds,
  indexChanged,
  visibleSectionIds,
}: {
  entryById: SearchIndex['entryById']
  matchedIds: Set<number>
  previousMatchedIds: Set<number>
  indexChanged: boolean
  visibleSectionIds: Set<string> | null
}) {
  let didLayoutChange = false

  for (const id of previousMatchedIds) {
    if (matchedIds.has(id)) continue

    const previousEntry = entryById.get(id)
    if (!previousEntry?.element) continue
    if (toggleHiddenClass(previousEntry.element, true)) {
      didLayoutChange = true
    }
  }

  for (const id of matchedIds) {
    const entry = entryById.get(id)
    if (!entry) continue

    if (visibleSectionIds && entry.sectionId) {
      visibleSectionIds.add(entry.sectionId)
    }

    const shouldEnsureVisible = indexChanged || !previousMatchedIds.has(id)
    if (!shouldEnsureVisible || !entry.element) continue

    if (toggleHiddenClass(entry.element, false)) {
      didLayoutChange = true
    }
  }

  return didLayoutChange
}

function syncSectionVisibility({
  sections,
  hasDeferredQuery,
  visibleSectionIds,
  sectionVisibilityById,
}: {
  sections: SearchIndex['sections']
  hasDeferredQuery: boolean
  visibleSectionIds: Set<string> | null
  sectionVisibilityById: Map<string, boolean>
}) {
  let didLayoutChange = false
  let visibleActiveSections = 0
  let visibleArchivedSections = 0

  for (const section of sections) {
    const visible = !hasDeferredQuery || Boolean(visibleSectionIds?.has(section.id))

    if (sectionVisibilityById.get(section.id) !== visible) {
      sectionVisibilityById.set(section.id, visible)
      if (toggleHiddenClass(section.element, !visible)) {
        didLayoutChange = true
      }
    }

    if (!visible || !hasDeferredQuery) continue
    if (section.status === 'active') visibleActiveSections += 1
    if (section.status === 'archived') visibleArchivedSections += 1
  }

  return { didLayoutChange, visibleActiveSections, visibleArchivedSections }
}

function syncArchivedDividerVisibility({
  archivedDivider,
  hasDeferredQuery,
  archivedBatchCount,
  archivedVisible,
  visibleActiveSections,
  visibleArchivedSections,
  previousVisible,
}: {
  archivedDivider: HTMLElement | null
  hasDeferredQuery: boolean
  archivedBatchCount: number
  archivedVisible: boolean
  visibleActiveSections: number
  visibleArchivedSections: number
  previousVisible: boolean
}) {
  if (!archivedDivider) {
    return { didLayoutChange: false, nextVisible: previousVisible }
  }

  const shouldShowDivider =
    archivedVisible &&
    (hasDeferredQuery
      ? visibleActiveSections > 0 && visibleArchivedSections > 0
      : archivedBatchCount > 0)

  if (shouldShowDivider === previousVisible) {
    return { didLayoutChange: false, nextVisible: previousVisible }
  }

  const didLayoutChange = toggleHiddenClass(archivedDivider, !shouldShowDivider)
  return { didLayoutChange, nextVisible: shouldShowDivider }
}

// ==================== Imperative sync orchestrator ====================

export interface DomSyncState {
  disableDomFiltering: boolean
  hasDeferredQuery: boolean
  hiddenArchivedMatchedCount: number
  matchedIds: Set<number>
  resolvedIndex: SearchIndex
  archivedBatchCount: number
  archivedVisible: boolean
  statusMessage: string
  visibleEntriesCount: number
}

interface DomSyncRefs {
  liveElement: HTMLElement | null
  previousMatchedIds: Set<number>
  previousFilterIndex: SearchIndex | null
  sectionVisibilityById: Map<string, boolean>
  archivedDividerVisible: boolean
}

export function createDomSyncRefs(): DomSyncRefs {
  return {
    liveElement: null,
    previousMatchedIds: new Set(),
    previousFilterIndex: null,
    sectionVisibilityById: new Map(),
    archivedDividerVisible: false,
  }
}

export function syncDom(state: DomSyncState, refs: DomSyncRefs) {
  const {
    disableDomFiltering,
    hasDeferredQuery,
    hiddenArchivedMatchedCount,
    matchedIds,
    resolvedIndex,
    archivedBatchCount,
    archivedVisible,
    statusMessage,
    visibleEntriesCount,
  } = state

  if (disableDomFiltering) {
    if (visibleEntriesCount > 0) {
      setTextContentIfChanged(refs.liveElement, statusMessage)
    }
    return
  }

  const { entryById, sections, archivedDivider } = resolvedIndex
  const previousMatchedIds = refs.previousMatchedIds
  const matchedIdsChanged = !areSetsEqual(previousMatchedIds, matchedIds)
  const indexChanged = refs.previousFilterIndex !== resolvedIndex
  const visibleSectionIds = hasDeferredQuery ? new Set<string>() : null
  let didLayoutChange = false

  if (!matchedIdsChanged && !indexChanged) {
    setTextContentIfChanged(refs.liveElement, statusMessage)
    return
  }

  if (indexChanged) {
    didLayoutChange =
      syncEntryVisibilityForIndexChange({
        entryById,
        matchedIds,
        hasDeferredQuery,
        visibleSectionIds,
      }) || didLayoutChange
  } else if (matchedIdsChanged) {
    didLayoutChange =
      syncEntryVisibilityForMatchedDiff({
        entryById,
        matchedIds,
        previousMatchedIds,
        indexChanged,
        visibleSectionIds,
      }) || didLayoutChange
  }

  refs.previousMatchedIds = matchedIds
  refs.previousFilterIndex = resolvedIndex

  const { archivedPlaceholder } = resolvedIndex
  if (archivedPlaceholder) {
    const shouldHidePlaceholder =
      archivedVisible || (hasDeferredQuery && hiddenArchivedMatchedCount === 0)
    if (toggleHiddenClass(archivedPlaceholder, shouldHidePlaceholder)) {
      didLayoutChange = true
    }
  }

  if (visibleEntriesCount === 0) {
    return
  }

  const sectionSyncResult = syncSectionVisibility({
    sections,
    hasDeferredQuery,
    visibleSectionIds,
    sectionVisibilityById: refs.sectionVisibilityById,
  })
  didLayoutChange = sectionSyncResult.didLayoutChange || didLayoutChange

  const dividerSyncResult = syncArchivedDividerVisibility({
    archivedDivider,
    hasDeferredQuery,
    archivedBatchCount,
    archivedVisible,
    visibleActiveSections: sectionSyncResult.visibleActiveSections,
    visibleArchivedSections: sectionSyncResult.visibleArchivedSections,
    previousVisible: refs.archivedDividerVisible,
  })
  refs.archivedDividerVisible = dividerSyncResult.nextVisible
  didLayoutChange = dividerSyncResult.didLayoutChange || didLayoutChange

  setTextContentIfChanged(refs.liveElement, statusMessage)

  if (didLayoutChange) {
    dispatchSidebarSearchState()
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/home/search/commissionSearchDomSync.ts
git commit -m "refactor(search): create imperative DOM sync module from useCommissionSearchDomSync"
```

---

## Task 5: Create suggestion panel controller

Replace `useSuggestionPanelController.ts` with vanilla event listeners.

**Files:**

- Create: `apps/web/src/features/home/search/commissionSearchSuggestions.ts`

- [ ] **Step 1: Create `commissionSearchSuggestions.ts`**

```ts
// apps/web/src/features/home/search/commissionSearchSuggestions.ts

interface SuggestionPanelController {
  focusInputAfterSelection: (nextQuery: string, options?: { preventScroll?: boolean }) => void
  shouldSuppressInputFocusOpen: () => boolean
  bindOutsideListeners: (searchRoot: HTMLElement, dismissFn: () => void) => void
  unbindOutsideListeners: () => void
}

export function createSuggestionPanelController(
  inputEl: HTMLInputElement,
): SuggestionPanelController {
  let suppressNextFocusOpen = false
  let cleanupOutsideListeners: (() => void) | null = null

  function focusInputAfterSelection(nextQuery: string, options?: { preventScroll?: boolean }) {
    suppressNextFocusOpen = true

    requestAnimationFrame(() => {
      inputEl.focus(options)
      const cursor = nextQuery.length
      inputEl.setSelectionRange(cursor, cursor)

      requestAnimationFrame(() => {
        suppressNextFocusOpen = false
      })
    })
  }

  function shouldSuppressInputFocusOpen() {
    if (!suppressNextFocusOpen) return false
    suppressNextFocusOpen = false
    return true
  }

  function bindOutsideListeners(searchRoot: HTMLElement, dismissFn: () => void) {
    unbindOutsideListeners()

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (searchRoot.contains(target)) return
      dismissFn()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.key !== 'Escape') return
      dismissFn()
    }

    window.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDown)

    cleanupOutsideListeners = () => {
      window.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }

  function unbindOutsideListeners() {
    cleanupOutsideListeners?.()
    cleanupOutsideListeners = null
  }

  return {
    focusInputAfterSelection,
    shouldSuppressInputFocusOpen,
    bindOutsideListeners,
    unbindOutsideListeners,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/home/search/commissionSearchSuggestions.ts
git commit -m "refactor(search): create vanilla suggestion panel controller"
```

---

## Task 6: Create keyboard navigation module

Replace cmdk's built-in keyboard navigation with a hand-written listbox controller.

**Files:**

- Create: `apps/web/src/features/home/search/commissionSearchKeyboard.ts`
- Create: `apps/web/src/features/home/search/commissionSearchKeyboard.test.ts`

- [ ] **Step 1: Create `commissionSearchKeyboard.ts`**

```ts
// apps/web/src/features/home/search/commissionSearchKeyboard.ts

export interface ListboxController {
  /** Attach keyboard listeners to the input element */
  bind: () => void
  /** Remove keyboard listeners */
  unbind: () => void
  /** Update the active (highlighted) item index. -1 = none */
  setActiveIndex: (index: number) => void
  /** Read the current active index */
  getActiveIndex: () => number
  /** Reset active index to first item or -1 */
  reset: () => void
}

interface ListboxOptions {
  inputEl: HTMLInputElement
  listEl: HTMLElement
  getItemCount: () => number
  onSelect: (index: number) => void
  onDismiss: () => void
}

export function createListboxController(options: ListboxOptions): ListboxController {
  const { inputEl, listEl, getItemCount, onSelect, onDismiss } = options
  let activeIndex = -1

  function getItems(): HTMLElement[] {
    return Array.from(listEl.querySelectorAll<HTMLElement>('[role="option"]'))
  }

  function setActiveIndex(index: number) {
    const items = getItems()

    // Clear previous
    if (activeIndex >= 0 && activeIndex < items.length) {
      items[activeIndex].setAttribute('data-selected', 'false')
    }

    activeIndex = index

    // Set new
    if (activeIndex >= 0 && activeIndex < items.length) {
      const item = items[activeIndex]
      item.setAttribute('data-selected', 'true')
      item.scrollIntoView({ block: 'nearest' })
      inputEl.setAttribute('aria-activedescendant', item.id || '')
    } else {
      inputEl.removeAttribute('aria-activedescendant')
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    const count = getItemCount()
    if (count === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      const next = activeIndex < count - 1 ? activeIndex + 1 : 0
      setActiveIndex(next)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      const prev = activeIndex > 0 ? activeIndex - 1 : count - 1
      setActiveIndex(prev)
      return
    }

    if (event.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < count) {
        event.preventDefault()
        onSelect(activeIndex)
      }
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onDismiss()
    }
  }

  return {
    bind() {
      inputEl.addEventListener('keydown', handleKeyDown)
    },
    unbind() {
      inputEl.removeEventListener('keydown', handleKeyDown)
    },
    setActiveIndex,
    getActiveIndex: () => activeIndex,
    reset() {
      const count = getItemCount()
      setActiveIndex(count > 0 ? 0 : -1)
    },
  }
}
```

- [ ] **Step 2: Write tests**

```ts
// apps/web/src/features/home/search/commissionSearchKeyboard.test.ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createListboxController } from './commissionSearchKeyboard'

describe('createListboxController', () => {
  let inputEl: HTMLInputElement
  let listEl: HTMLElement
  let onSelect: ReturnType<typeof vi.fn>
  let onDismiss: ReturnType<typeof vi.fn>

  beforeEach(() => {
    inputEl = document.createElement('input')
    listEl = document.createElement('ul')
    listEl.setAttribute('role', 'listbox')
    for (let i = 0; i < 3; i++) {
      const li = document.createElement('li')
      li.setAttribute('role', 'option')
      li.id = `option-${i}`
      li.textContent = `Option ${i}`
      listEl.appendChild(li)
    }
    document.body.appendChild(inputEl)
    document.body.appendChild(listEl)
    onSelect = vi.fn()
    onDismiss = vi.fn()
  })

  it('cycles through items on ArrowDown', () => {
    const ctrl = createListboxController({
      inputEl,
      listEl,
      getItemCount: () => 3,
      onSelect,
      onDismiss,
    })
    ctrl.bind()

    inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(ctrl.getActiveIndex()).toBe(0)

    inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(ctrl.getActiveIndex()).toBe(1)

    ctrl.unbind()
  })

  it('wraps around on ArrowDown past last item', () => {
    const ctrl = createListboxController({
      inputEl,
      listEl,
      getItemCount: () => 3,
      onSelect,
      onDismiss,
    })
    ctrl.bind()
    ctrl.setActiveIndex(2)

    inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(ctrl.getActiveIndex()).toBe(0)

    ctrl.unbind()
  })

  it('calls onSelect with active index on Enter', () => {
    const ctrl = createListboxController({
      inputEl,
      listEl,
      getItemCount: () => 3,
      onSelect,
      onDismiss,
    })
    ctrl.bind()
    ctrl.setActiveIndex(1)

    inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(onSelect).toHaveBeenCalledWith(1)

    ctrl.unbind()
  })

  it('calls onDismiss on Escape', () => {
    const ctrl = createListboxController({
      inputEl,
      listEl,
      getItemCount: () => 3,
      onSelect,
      onDismiss,
    })
    ctrl.bind()

    inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(onDismiss).toHaveBeenCalled()

    ctrl.unbind()
  })
})
```

- [ ] **Step 3: Run tests**

Run: `cd apps/web && bunx vitest run src/features/home/search/commissionSearchKeyboard.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/home/search/commissionSearchKeyboard.ts apps/web/src/features/home/search/commissionSearchKeyboard.test.ts
git commit -m "feat(search): add vanilla keyboard navigation for suggestion listbox"
```

---

## Task 7: Create the search store

Central state management replacing all React `useState`/`useRef` calls.

**Files:**

- Create: `apps/web/src/features/home/search/commissionSearchStore.ts`

- [ ] **Step 1: Create `commissionSearchStore.ts`**

```ts
// apps/web/src/features/home/search/commissionSearchStore.ts
import type {
  CommissionSearchEntrySource,
  SearchIndex,
  SearchSuggestionAliasGroup,
} from '@features/home/search/commissionSearchIndex'
import type { SuggestionTokenOperator } from '@lib/search/index'
import type { CommissionViewMode } from '@features/home/search/commissionViewMode'
import type { PanelLoadedState } from '@features/home/search/commissionSearchPanelState'
import type { SuggestionViewModel } from '@features/home/search/commissionSearchDropdownRenderer'

export interface SearchState {
  // Input
  query: string
  inputQuery: string | null

  // Index
  isIndexReady: boolean
  shouldWarmFuse: boolean
  externalEntries: CommissionSearchEntrySource[] | null
  resolvedIndex: SearchIndex

  // Matching
  matchedIds: Set<number>
  deferredQuery: string

  // Suggestions
  isSuggestionPanelDismissed: boolean
  activeCommandValue: string
  suggestionViewModels: SuggestionViewModel[]
  suggestionOperator: SuggestionTokenOperator
  suggestionIsExclusion: boolean
  shouldShowSuggestionPanel: boolean
  shouldAnimateSuggestionPanel: boolean
  shouldShowHiddenArchivedNotice: boolean

  // Display
  visibleStatusMessage: string
  hiddenArchivedNoticeMessage: string
  visibleEntriesCount: number
  visibleMatchedCount: number
  hiddenArchivedMatchedCount: number

  // Popular keywords
  popularKeywordPage: number
  hasDismissedFeaturedKeywords: boolean
  popularKeywordPool: string[]
  popularKeywords: string[]

  // Copy
  copyState: 'idle' | 'success'

  // Help
  isHelpOpen: boolean

  // External state
  mode: CommissionViewMode
  panelState: PanelLoadedState
}

type Listener = () => void
const listeners = new Set<Listener>()
let state: SearchState | null = null

export function initStore(initial: SearchState) {
  state = initial
}

export function getState(): SearchState {
  if (!state) throw new Error('Search store not initialized')
  return state
}

export function setState(next: Partial<SearchState>) {
  if (!state) throw new Error('Search store not initialized')
  Object.assign(state, next)
  for (const fn of listeners) fn()
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function batchUpdate(updater: () => void) {
  // Collect updates without notifying, then notify once
  const saved = new Set(listeners)
  listeners.clear()
  try {
    updater()
  } finally {
    for (const fn of saved) listeners.add(fn)
  }
  for (const fn of listeners) fn()
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/home/search/commissionSearchStore.ts
git commit -m "feat(search): add lightweight pub/sub state store"
```

---

## Task 8: Create suggestion dropdown renderer

Replace `CommissionSearchSuggestionDropdown.tsx` JSX with imperative DOM rendering.

**Files:**

- Create: `apps/web/src/features/home/search/commissionSearchDropdownRenderer.ts`

- [ ] **Step 1: Create `commissionSearchDropdownRenderer.ts`**

```ts
// apps/web/src/features/home/search/commissionSearchDropdownRenderer.ts
import type { SuggestionTokenOperator } from '@lib/search/index'
import { LOAD_ARCHIVED_COMMAND_VALUE } from './commissionSearchConstants'

export interface SuggestionViewModel {
  term: string
  matchCountLabel: string
  sourcesLabel: string
  relatedTerms: string[]
}

interface RenderDropdownOptions {
  container: HTMLElement
  suggestionViewModels: SuggestionViewModel[]
  suggestionIsExclusion: boolean
  suggestionOperator: SuggestionTokenOperator
  sourcePrefix: string
  shouldShowHiddenArchivedNotice: boolean
  hiddenArchivedNoticeMessage: string
  visibleStatusMessage: string
  loadArchivedCharactersLabel: string
  onSelectSuggestion: (term: string) => void
  onLoadArchivedCharacters: () => void
}

function createOperatorBadge(text: string): HTMLSpanElement {
  const badge = document.createElement('span')
  badge.className = `
    shrink-0 rounded-sm border border-gray-300/90
    bg-gray-100/85 px-1 py-0.5 text-[10px] leading-none
    tracking-[0.06em] text-gray-600
    dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300
  `.trim()
  badge.textContent = text
  return badge
}

function createSuggestionItem(
  suggestion: SuggestionViewModel,
  index: number,
  options: Pick<
    RenderDropdownOptions,
    'suggestionIsExclusion' | 'suggestionOperator' | 'sourcePrefix' | 'onSelectSuggestion'
  >,
): HTMLElement {
  const item = document.createElement('div')
  item.setAttribute('role', 'option')
  item.id = `search-suggestion-${index}`
  item.dataset.value = suggestion.term
  item.dataset.selected = 'false'
  item.className = `
    relative flex cursor-default items-center rounded-sm
    px-3 py-1.5 font-mono text-gray-700 select-none
    data-[selected=true]:bg-gray-900/6
    data-[selected=true]:text-gray-900
    dark:text-gray-300
    dark:data-[selected=true]:bg-white/10
    dark:data-[selected=true]:text-white
  `.trim()

  item.addEventListener('click', () => options.onSelectSuggestion(suggestion.term))

  // Grid container
  const grid = document.createElement('div')
  grid.className = `
    grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-start
    gap-x-3 gap-y-0.5
  `.trim()

  // Term row
  const termRow = document.createElement('span')
  termRow.className = 'flex min-w-0 items-center gap-1.5'

  if (options.suggestionIsExclusion) {
    termRow.appendChild(createOperatorBadge('NOT'))
  } else if (options.suggestionOperator === 'or') {
    termRow.appendChild(createOperatorBadge('OR'))
  } else if (options.suggestionOperator === 'and') {
    termRow.appendChild(createOperatorBadge('AND'))
  }

  const termTextWrapper = document.createElement('span')
  termTextWrapper.className = 'flex min-w-0 items-baseline gap-1 truncate'
  const termText = document.createElement('span')
  termText.className = 'truncate'
  termText.textContent = suggestion.term
  termTextWrapper.appendChild(termText)

  if (suggestion.relatedTerms.length > 0) {
    const related = document.createElement('span')
    related.className = 'truncate text-[11px]/4 text-gray-500 dark:text-gray-400'
    related.textContent = `(${suggestion.relatedTerms.join(' / ')})`
    termTextWrapper.appendChild(related)
  }

  termRow.appendChild(termTextWrapper)
  grid.appendChild(termRow)

  // Match count
  const countEl = document.createElement('span')
  countEl.className = `
    col-start-2 row-span-2 self-center text-right text-[11px]/4
    text-gray-500 tabular-nums dark:text-gray-400
  `.trim()
  countEl.textContent = suggestion.matchCountLabel
  grid.appendChild(countEl)

  // Source row
  const sourceEl = document.createElement('span')
  sourceEl.className = 'truncate text-[11px]/4 text-gray-500 dark:text-gray-400'
  sourceEl.textContent = `${options.sourcePrefix} ${suggestion.sourcesLabel}`
  grid.appendChild(sourceEl)

  item.appendChild(grid)
  return item
}

export function renderDropdown(options: RenderDropdownOptions) {
  const { container } = options
  container.innerHTML = ''

  for (let i = 0; i < options.suggestionViewModels.length; i++) {
    container.appendChild(createSuggestionItem(options.suggestionViewModels[i], i, options))
  }

  if (options.shouldShowHiddenArchivedNotice) {
    const divider = document.createElement('div')
    divider.className = 'mt-1 border-t border-gray-200/80 pt-1 dark:border-gray-700/80'

    const noticeItem = document.createElement('div')
    noticeItem.setAttribute('role', 'option')
    noticeItem.id = `search-suggestion-${options.suggestionViewModels.length}`
    noticeItem.dataset.value = LOAD_ARCHIVED_COMMAND_VALUE
    noticeItem.dataset.selected = 'false'
    noticeItem.className = `
      relative flex cursor-default items-start gap-3 rounded-sm
      px-3 py-2 font-mono text-gray-700 select-none
      data-[selected=true]:bg-gray-900/6
      data-[selected=true]:text-gray-900
      dark:text-gray-300
      dark:data-[selected=true]:bg-white/10
      dark:data-[selected=true]:text-white
    `.trim()
    noticeItem.addEventListener('click', options.onLoadArchivedCharacters)

    const textWrapper = document.createElement('div')
    textWrapper.className = 'min-w-0 flex-1'

    const messageP = document.createElement('p')
    messageP.className = 'text-[12px]/4 wrap-break-word whitespace-normal'
    messageP.textContent = options.hiddenArchivedNoticeMessage
    textWrapper.appendChild(messageP)

    const statusP = document.createElement('p')
    statusP.className = 'mt-0.5 text-[11px]/4 text-gray-500 dark:text-gray-400'
    statusP.textContent = options.visibleStatusMessage
    textWrapper.appendChild(statusP)

    noticeItem.appendChild(textWrapper)

    const loadLabel = document.createElement('span')
    loadLabel.className = 'shrink-0 text-[11px]/4 text-gray-500 dark:text-gray-400'
    loadLabel.textContent = options.loadArchivedCharactersLabel
    noticeItem.appendChild(loadLabel)

    divider.appendChild(noticeItem)
    container.appendChild(divider)
  }
}

export function getDropdownItemCount(container: HTMLElement): number {
  return container.querySelectorAll('[role="option"]').length
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/home/search/commissionSearchDropdownRenderer.ts
git commit -m "feat(search): add imperative suggestion dropdown renderer"
```

---

## Task 9: Create help popover renderer

Replace `CommissionSearchHelpPopover.tsx` with an imperative renderer for the native popover.

**Files:**

- Create: `apps/web/src/features/home/search/commissionSearchHelpRenderer.ts`

- [ ] **Step 1: Create `commissionSearchHelpRenderer.ts`**

```ts
// apps/web/src/features/home/search/commissionSearchHelpRenderer.ts
import type { HomeSearchControls } from '@features/home/i18n/homeSearchControls'

export function renderHelpContent(container: HTMLElement, controls: HomeSearchControls) {
  // Only render once — content is static for a given locale
  if (container.dataset.rendered === 'true') return
  container.dataset.rendered = 'true'

  container.innerHTML = ''

  const wrapper = document.createElement('div')
  wrapper.className = 'space-y-3 p-4'

  // Title
  const h2 = document.createElement('h2')
  h2.className = 'text-base font-bold text-gray-900 md:text-lg dark:text-gray-100'
  h2.textContent = controls.searchHelpTitle
  wrapper.appendChild(h2)

  // Intro
  const intro = document.createElement('p')
  intro.className = 'text-xs md:text-sm'
  intro.textContent = controls.searchHelpIntro
  wrapper.appendChild(intro)

  // Table container
  const tableWrap = document.createElement('div')
  tableWrap.className = `
    max-h-[min(50vh,22rem)] overflow-auto rounded-lg border
    border-gray-200/90 dark:border-gray-700/90
  `.trim()

  const table = document.createElement('table')
  table.className = `
    w-full min-w-[18rem] border-separate border-spacing-0 text-left
    text-xs/relaxed md:text-sm
  `.trim()

  // Thead
  const thead = document.createElement('thead')
  thead.className =
    'sticky top-0 bg-gray-100/90 text-gray-600 dark:bg-gray-800/90 dark:text-gray-300'
  const headRow = document.createElement('tr')
  const th1 = document.createElement('th')
  th1.className = 'px-3 py-2 font-semibold'
  th1.textContent = controls.searchHelpSyntaxHeader
  const th2 = document.createElement('th')
  th2.className = 'px-3 py-2 font-semibold'
  th2.textContent = controls.searchHelpMeaningHeader
  headRow.append(th1, th2)
  thead.appendChild(headRow)
  table.appendChild(thead)

  // Tbody
  const tbody = document.createElement('tbody')
  tbody.className = 'divide-y divide-gray-200/80 dark:divide-gray-700/80'
  for (const row of controls.searchHelpRows) {
    const tr = document.createElement('tr')
    tr.className = 'align-top'

    const td1 = document.createElement('td')
    td1.className = 'w-20 px-3 py-2.5'
    const code1 = document.createElement('code')
    code1.className = `
      rounded-sm bg-gray-100 px-1.5 py-0.5 font-mono text-[11px]
      text-gray-700 md:text-xs dark:bg-gray-800 dark:text-gray-200
    `.trim()
    code1.textContent = row.syntax
    td1.appendChild(code1)

    const td2 = document.createElement('td')
    td2.className = 'px-3 py-2.5 text-[11px] sm:text-xs md:text-sm'
    const descP = document.createElement('p')
    descP.textContent = row.description
    td2.appendChild(descP)

    const exampleP = document.createElement('p')
    exampleP.className = 'mt-0.5 wrap-break-word text-gray-500 dark:text-gray-400'
    exampleP.textContent = `${controls.searchHelpExampleLabel}: `
    const code2 = document.createElement('code')
    code2.className = `
      rounded-sm bg-gray-100 px-1.5 py-0.5 font-mono text-[11px]
      text-gray-600 md:text-xs dark:bg-gray-800 dark:text-gray-300
    `.trim()
    code2.textContent = row.example
    exampleP.appendChild(code2)
    td2.appendChild(exampleP)

    tr.append(td1, td2)
    tbody.appendChild(tr)
  }
  table.appendChild(tbody)
  tableWrap.appendChild(table)
  wrapper.appendChild(tableWrap)

  // Combined example
  const combinedP = document.createElement('p')
  combinedP.className =
    'text-[11px] wrap-break-word text-gray-500 sm:text-xs md:text-sm dark:text-gray-400'
  combinedP.textContent = `${controls.searchHelpCombinedExampleLabel}: `
  const combinedCode = document.createElement('code')
  combinedCode.className = `
    rounded-sm bg-gray-100 px-1.5 py-0.5 font-mono text-[11px]
    text-gray-600 md:text-xs dark:bg-gray-800 dark:text-gray-300
  `.trim()
  combinedCode.textContent = 'blue hair | silver !sketch'
  combinedP.appendChild(combinedCode)
  wrapper.appendChild(combinedP)

  // Alias hint
  const aliasHint = document.createElement('p')
  aliasHint.className =
    'text-[11px] wrap-break-word text-gray-500 sm:text-xs md:text-sm dark:text-gray-400'
  aliasHint.textContent = controls.searchHelpAliasHint
  wrapper.appendChild(aliasHint)

  // Close button
  const btnWrap = document.createElement('div')
  btnWrap.className = 'flex justify-end'
  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = `
    rounded-md border border-gray-300/80 bg-white/85 px-3 py-1.5
    text-xs font-semibold text-gray-700 transition-colors
    hover:bg-gray-100
    focus-visible:outline-2 focus-visible:outline-offset-2
    focus-visible:outline-gray-500
    dark:border-gray-600 dark:bg-gray-900/80 dark:text-gray-200
    dark:hover:bg-gray-800
    dark:focus-visible:outline-gray-300
  `.trim()
  closeBtn.textContent = controls.searchHelpClose
  closeBtn.addEventListener('click', () => {
    const popover = container.closest('[popover]')
    if (popover instanceof HTMLElement) {
      popover.hidePopover()
    }
  })
  btnWrap.appendChild(closeBtn)
  wrapper.appendChild(btnWrap)

  container.appendChild(wrapper)
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/home/search/commissionSearchHelpRenderer.ts
git commit -m "feat(search): add imperative help popover content renderer"
```

---

## Task 10: Create search model (core orchestration)

Port the core search logic from `useCommissionSearchModel.ts` — index building, matching, suggestion filtering, deferred load requests, analytics, auto-show archived. This module operates on the store and produces derived state.

**Files:**

- Create: `apps/web/src/features/home/search/commissionSearchModel.ts`
- Modify: `apps/web/src/features/home/search/useCommissionSearchModel.test.ts` → rename to `commissionSearchModel.test.ts`

- [ ] **Step 1: Create `commissionSearchModel.ts`**

This file re-exports the pure functions (`getDomSnapshotKeyForMode`, `resolveEffectiveDomSnapshotKey`, `subscribeToUrlQuerySnapshot`, `dispatchSearchQueryLocationChange`) that existing tests depend on, and adds the imperative search model logic.

```ts
// apps/web/src/features/home/search/commissionSearchModel.ts
import type {
  CommissionSearchEntrySource,
  SearchIndex,
  SearchSuggestionAliasGroup,
} from '@features/home/search/commissionSearchIndex'
import type { SuggestionViewModel } from '@features/home/search/commissionSearchDropdownRenderer'
import type { PanelLoadedState } from '@features/home/search/commissionSearchPanelState'
import type { CommissionViewMode } from '@features/home/search/commissionViewMode'
import { requestActiveCharactersLoad } from '@features/home/commission/loader/activeCharactersEvent'
import {
  requestArchivedCharactersLoad,
  requestArchivedCharactersVisibility,
} from '@features/home/commission/loader/archivedCharactersEvent'
import { requestTimelineViewLoad } from '@features/home/commission/loader/timelineViewEvent'
import { LOAD_ARCHIVED_COMMAND_VALUE } from '@features/home/search/commissionSearchConstants'
import {
  buildRelatedSuggestionTermsMap,
  buildSearchIndex,
  createEmptySearchIndex,
  getDisplayMetrics,
} from '@features/home/search/commissionSearchIndex'
import { ANALYTICS_EVENTS } from '@lib/analytics/events'
import { trackRybbitEvent } from '@lib/analytics/track'
import {
  filterSuggestions,
  getMatchedEntryIds,
  hydrateSearchIndexFuse,
  normalizeQuery,
  parseSuggestionInputState,
  resolveSuggestionContextMatchedIds,
} from '@lib/search/index'

// ==================== Pure functions (re-exported for tests) ====================

const SEARCH_QUERY_LOCATION_CHANGE_EVENT = 'home:search-query-location-change'

export function getUrlQuerySnapshot() {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get('q') ?? ''
}

export function dispatchSearchQueryLocationChange() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(SEARCH_QUERY_LOCATION_CHANGE_EVENT))
}

export function subscribeToUrlQuerySnapshot(onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => {}

  window.addEventListener('popstate', onStoreChange)
  window.addEventListener(SEARCH_QUERY_LOCATION_CHANGE_EVENT, onStoreChange)

  return () => {
    window.removeEventListener('popstate', onStoreChange)
    window.removeEventListener(SEARCH_QUERY_LOCATION_CHANGE_EVENT, onStoreChange)
  }
}

export function getDomSnapshotKeyForMode({
  activeBatchCount,
  activeLoaded,
  mode,
  archivedBatchCount,
  archivedLoaded,
  archivedVisible,
  timelineLoaded,
}: {
  activeBatchCount: number
  activeLoaded: boolean
  mode: 'character' | 'timeline'
  archivedBatchCount: number
  archivedLoaded: boolean
  archivedVisible: boolean
  timelineLoaded: boolean
}) {
  return mode === 'character'
    ? `character:active-${activeLoaded ? 'loaded' : 'pending'}-${activeBatchCount}:archived-${
        archivedLoaded ? 'loaded' : archivedVisible ? 'visible' : 'hidden'
      }-${archivedBatchCount}`
    : `timeline:${timelineLoaded ? 'timeline-loaded' : 'timeline-pending'}`
}

export function resolveEffectiveDomSnapshotKey({
  domSnapshotKey,
  skipDomContext,
}: {
  domSnapshotKey: string
  skipDomContext: boolean
}) {
  return skipDomContext ? 'skip-dom-context' : domSnapshotKey
}

// ==================== Search model (imperative) ====================

interface SearchControls {
  sourceCharacter: string
  sourceCreator: string
  sourceKeyword: string
  sourceDate: string
  formatMatchCount: (count: number) => string
  formatSearchResultsStatus: (matchedCount: number, totalCount: number) => string
  formatSearchClearedStatus: (totalCount: number) => string
  formatHiddenArchivedResultsNotice: (hiddenCount: number) => string
}

export interface SearchModelInput {
  query: string
  mode: CommissionViewMode
  panelState: PanelLoadedState
  externalEntries?: CommissionSearchEntrySource[]
  isIndexReady: boolean
  shouldWarmFuse: boolean
  isSuggestionPanelDismissed: boolean
  activeCommandValue: string
  controls: SearchControls
  suggestionAliasGroups: SearchSuggestionAliasGroup[]
  disableDomFiltering: boolean
  suppressInitialSuggestionPanelAnimation: boolean
  initialQuery?: string
}

export interface SearchModelOutput {
  resolvedIndex: SearchIndex
  matchedIds: Set<number>
  hasDeferredQuery: boolean
  hasQuery: boolean
  suggestionViewModels: SuggestionViewModel[]
  suggestionOperator: ReturnType<typeof parseSuggestionInputState>['suggestionOperator']
  suggestionIsExclusion: boolean
  shouldShowSuggestionPanel: boolean
  shouldAnimateSuggestionPanel: boolean
  shouldShowHiddenArchivedNotice: boolean
  visibleStatusMessage: string
  hiddenArchivedNoticeMessage: string
  visibleEntriesCount: number
  visibleMatchedCount: number
  hiddenArchivedMatchedCount: number
  resolvedActiveCommandValue: string
}

// Memoization cache keys
let cachedIndexKey = ''
let cachedIndex: SearchIndex = createEmptySearchIndex()
let cachedHydratedIndex: SearchIndex | null = null
let pendingHydration: Promise<SearchIndex> | null = null
let didRequestActiveAll = false
let didRequestArchivedAll = false
let didRequestTimelineAll = false
let didAutoShowArchived = false
let hasTrackedSearchUsage = false
const MIN_TRACK_QUERY_LENGTH = 2

export function resetModelState() {
  cachedIndexKey = ''
  cachedIndex = createEmptySearchIndex()
  cachedHydratedIndex = null
  pendingHydration = null
  didRequestActiveAll = false
  didRequestArchivedAll = false
  didRequestTimelineAll = false
  didAutoShowArchived = false
  hasTrackedSearchUsage = false
}

export function computeSearchModel(input: SearchModelInput): SearchModelOutput {
  const {
    query,
    mode,
    panelState,
    externalEntries,
    isIndexReady,
    shouldWarmFuse,
    isSuggestionPanelDismissed,
    activeCommandValue,
    controls,
    suggestionAliasGroups,
    disableDomFiltering,
    suppressInitialSuggestionPanelAnimation,
    initialQuery,
  } = input

  const normalizedQuery = normalizeQuery(query)
  const hasQuery = !!normalizedQuery
  const hasDeferredQuery = hasQuery // In vanilla, no deferred value needed — we use requestIdleCallback at the caller level

  // Parse suggestion input
  const parsed = parseSuggestionInputState(query)
  const suggestionQuery = normalizeQuery(parsed.suggestionQuery)
  const { suggestionContextQuery, suggestionOperator, suggestionIsExclusion } = parsed

  // Source labels
  const suggestionSourceLabels = {
    Character: controls.sourceCharacter,
    Creator: controls.sourceCreator,
    Keyword: controls.sourceKeyword,
    Date: controls.sourceDate,
  } as const

  // Build index
  const shouldBuildIndex = isIndexReady || !!query
  const shouldSkipDomContext = disableDomFiltering && Boolean(externalEntries)
  const domSnapshotKey = getDomSnapshotKeyForMode({
    ...panelState,
    mode,
  })
  const effectiveDomSnapshotKey = resolveEffectiveDomSnapshotKey({
    domSnapshotKey,
    skipDomContext: shouldSkipDomContext,
  })

  const indexKey = `${effectiveDomSnapshotKey}:${shouldBuildIndex}:${shouldSkipDomContext}:${externalEntries?.length ?? 0}:${mode}`
  if (indexKey !== cachedIndexKey) {
    cachedIndexKey = indexKey
    cachedIndex = shouldBuildIndex
      ? buildSearchIndex(mode, externalEntries, {
          domSnapshotKey: effectiveDomSnapshotKey,
          skipDomContext: shouldSkipDomContext,
        })
      : createEmptySearchIndex()
  }

  // Resolve hydrated index
  let resolvedIndex = cachedIndex
  if (cachedHydratedIndex && cachedHydratedIndex.entries === cachedIndex.entries) {
    if (!cachedIndex.fuse && cachedHydratedIndex.fuse) {
      resolvedIndex = { ...cachedIndex, fuse: cachedHydratedIndex.fuse }
    }
  }

  // Trigger Fuse hydration if needed
  const shouldHydrateFuse = shouldWarmFuse || hasQuery
  if (
    shouldHydrateFuse &&
    cachedIndex.entries.length > 0 &&
    !resolvedIndex.fuse &&
    !pendingHydration
  ) {
    pendingHydration = hydrateSearchIndexFuse(cachedIndex).then(nextIndex => {
      cachedHydratedIndex = nextIndex
      pendingHydration = null
      return nextIndex
    })
  }

  // Deferred load requests
  const shouldRequestActive =
    !disableDomFiltering && mode === 'character' && hasDeferredQuery && !panelState.activeLoaded
  if (shouldRequestActive && !didRequestActiveAll) {
    didRequestActiveAll = true
    requestActiveCharactersLoad(window, { strategy: 'all' })
  } else if (!shouldRequestActive) {
    didRequestActiveAll = false
  }

  const shouldRequestArchived =
    !disableDomFiltering &&
    mode === 'character' &&
    hasDeferredQuery &&
    panelState.archivedVisible &&
    !panelState.archivedLoaded
  if (shouldRequestArchived && !didRequestArchivedAll) {
    didRequestArchivedAll = true
    requestArchivedCharactersLoad(window, { preserveScroll: true, strategy: 'all' })
  } else if (!shouldRequestArchived) {
    didRequestArchivedAll = false
  }

  const shouldRequestTimeline =
    !disableDomFiltering && mode === 'timeline' && hasDeferredQuery && !panelState.timelineLoaded
  if (shouldRequestTimeline && !didRequestTimelineAll) {
    didRequestTimelineAll = true
    requestTimelineViewLoad(window, { strategy: 'all' })
  } else if (!shouldRequestTimeline) {
    didRequestTimelineAll = false
  }

  // Matching
  const matchedIds = getMatchedEntryIds(query, resolvedIndex)
  const { visibleEntriesCount, visibleMatchedCount, hiddenArchivedMatchedCount } =
    getDisplayMetrics({
      searchIndex: resolvedIndex,
      matchedIds,
      disableDomFiltering,
      hasDeferredQuery,
      mode,
      archivedLoaded: panelState.archivedLoaded,
    })

  // Auto-show archived
  if (!hasDeferredQuery || visibleMatchedCount > 0) {
    didAutoShowArchived = false
  } else if (
    !didAutoShowArchived &&
    !disableDomFiltering &&
    mode === 'character' &&
    panelState.activeLoaded &&
    !panelState.archivedVisible &&
    hiddenArchivedMatchedCount > 0
  ) {
    didAutoShowArchived = true
    requestArchivedCharactersVisibility(window, 'visible')
  }

  // Suggestions
  const suggestionContextMatchedIds = resolveSuggestionContextMatchedIds({
    rawQuery: query,
    suggestionQuery,
    suggestionContextQuery,
    matchedIds,
    index: resolvedIndex,
    suggestionOperator,
  })
  const filteredSuggestions = filterSuggestions({
    entries: resolvedIndex.entries,
    suggestions: resolvedIndex.suggestions,
    suggestionQuery,
    suggestionContextQuery,
    suggestionContextMatchedIds,
    isExclusionSuggestion: suggestionIsExclusion,
  })
  const EMPTY_RELATED_MAP = new Map<string, string[]>()
  const relatedSuggestionTermsMap =
    filteredSuggestions.length > 0
      ? buildRelatedSuggestionTermsMap(resolvedIndex.entries, suggestionAliasGroups)
      : EMPTY_RELATED_MAP

  const suggestionViewModels: SuggestionViewModel[] = filteredSuggestions.map(suggestion => ({
    term: suggestion.term,
    matchCountLabel: controls.formatMatchCount(suggestion.matchedCount),
    sourcesLabel: suggestion.sources.map(source => suggestionSourceLabels[source]).join(' / '),
    relatedTerms: relatedSuggestionTermsMap.get(suggestion.term.trim().toLowerCase()) ?? [],
  }))

  const shouldShowHiddenArchivedNotice = hiddenArchivedMatchedCount > 0
  const shouldShowSuggestionPanel =
    !isSuggestionPanelDismissed &&
    hasQuery &&
    (suggestionViewModels.length > 0 || shouldShowHiddenArchivedNotice)

  const visibleStatusMessage = hasDeferredQuery
    ? controls.formatSearchResultsStatus(visibleMatchedCount, visibleEntriesCount)
    : controls.formatSearchClearedStatus(visibleEntriesCount)
  const hiddenArchivedNoticeMessage = controls.formatHiddenArchivedResultsNotice(
    hiddenArchivedMatchedCount,
  )

  // Resolve active command value (replaces cmdk's value tracking)
  let resolvedActiveCommandValue = ''
  if (shouldShowHiddenArchivedNotice && activeCommandValue === LOAD_ARCHIVED_COMMAND_VALUE) {
    resolvedActiveCommandValue = LOAD_ARCHIVED_COMMAND_VALUE
  } else if (suggestionViewModels.some(item => item.term === activeCommandValue)) {
    resolvedActiveCommandValue = activeCommandValue
  } else if (suggestionViewModels.length > 0) {
    resolvedActiveCommandValue = suggestionViewModels[0].term
  } else if (shouldShowHiddenArchivedNotice) {
    resolvedActiveCommandValue = LOAD_ARCHIVED_COMMAND_VALUE
  }

  const shouldSuppressHandoffPanelAnimation =
    suppressInitialSuggestionPanelAnimation && !!initialQuery && query === initialQuery
  const shouldAnimateSuggestionPanel = !shouldSuppressHandoffPanelAnimation

  // Analytics
  if (normalizedQuery.length >= MIN_TRACK_QUERY_LENGTH && !hasTrackedSearchUsage) {
    if (resolvedIndex.entries.length === 0 || resolvedIndex.fuse) {
      hasTrackedSearchUsage = true
      trackRybbitEvent(ANALYTICS_EVENTS.searchUsed, {
        source: 'input',
      })
    }
  }

  return {
    resolvedIndex,
    matchedIds,
    hasDeferredQuery,
    hasQuery,
    suggestionViewModels,
    suggestionOperator,
    suggestionIsExclusion,
    shouldShowSuggestionPanel,
    shouldAnimateSuggestionPanel,
    shouldShowHiddenArchivedNotice,
    visibleStatusMessage,
    hiddenArchivedNoticeMessage,
    visibleEntriesCount,
    visibleMatchedCount,
    hiddenArchivedMatchedCount,
    resolvedActiveCommandValue,
  }
}
```

- [ ] **Step 2: Rename existing test file and update imports**

Rename `useCommissionSearchModel.test.ts` → `commissionSearchModel.test.ts`. Update the import path:

```ts
// apps/web/src/features/home/search/commissionSearchModel.test.ts
// (same content as useCommissionSearchModel.test.ts, only import path changes)
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import {
  dispatchSearchQueryLocationChange,
  getDomSnapshotKeyForMode,
  resolveEffectiveDomSnapshotKey,
  subscribeToUrlQuerySnapshot,
} from './commissionSearchModel'

// ... rest of test file unchanged ...
```

- [ ] **Step 3: Run test**

Run: `cd apps/web && bunx vitest run src/features/home/search/commissionSearchModel.test.ts`
Expected: PASS (same tests, new import path)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/home/search/commissionSearchModel.ts apps/web/src/features/home/search/commissionSearchModel.test.ts
git commit -m "refactor(search): create imperative search model replacing useCommissionSearchModel hook"
```

---

## Task 11: Create the Astro template

Build `CommissionSearchIsland.astro` that renders the identical HTML structure currently produced by the React components. This is the largest single file — it replaces the JSX from `CommissionSearch.tsx`, `CommissionSearchSuggestionDropdown.tsx`, `CommissionSearchHelpPopover.tsx`, `PopularKeywordsRow.tsx`, and `SurpriseMe.tsx`.

**Files:**

- Create: `apps/web/src/features/home/search/CommissionSearchIsland.astro`
- Reference: `apps/web/src/features/home/search/CommissionSearch.tsx` (lines 407–601 for JSX structure)
- Reference: `apps/web/src/features/home/search/PopularKeywordsRow.tsx` (lines 57–145)
- Reference: `apps/web/src/features/home/search/SurpriseMe.tsx` (lines 9–31)

- [ ] **Step 1: Create `CommissionSearchIsland.astro`**

The Astro template must produce the exact same DOM structure, class names, IDs, and `data-*` attributes as the React components. The `<script>` tag imports the controller module.

**Key DOM contract elements to preserve:**

- `<section id="commission-search">` — root container
- `<input id="commission-search-input">` — search input
- `role="combobox"` wrapper, `role="listbox"` dropdown, `role="option"` items
- `aria-expanded`, `aria-activedescendant` on input
- `data-selected` on suggestion items
- `<p aria-live="polite" class="sr-only">` — live region
- All Tailwind classes unchanged

```astro
---
// apps/web/src/features/home/search/CommissionSearchIsland.astro
import type { SearchSuggestionAliasGroup } from '@features/home/search/commissionSearchIndex'
import { resolveHomeSearchControls } from '@features/home/i18n/homeSearchControls'

interface Props {
  locale?: string
  featuredKeywords?: string[]
  suggestionAliasGroups?: SearchSuggestionAliasGroup[]
}

const {
  locale,
  featuredKeywords = [],
  suggestionAliasGroups = [],
} = Astro.props

const controls = resolveHomeSearchControls(locale)
---

<section
  id="commission-search"
  class="mt-4 mb-8 md:mt-4 md:mb-10 lg:mt-6 lg:mb-12"
  data-locale={locale}
  data-featured-keywords={JSON.stringify(featuredKeywords)}
  data-suggestion-alias-groups={JSON.stringify(suggestionAliasGroups)}
  data-controls={JSON.stringify(controls)}
>
  <div class="flex h-12 items-center justify-end">
    <div class="
      relative h-11 w-full overflow-visible border-b border-gray-300/80
      bg-transparent text-gray-700
      dark:border-gray-700 dark:text-gray-300
    ">
      {/* Search icon (inline SVG replaces @tabler/icons-react IconSearch) */}
      <svg
        class="absolute top-1/2 left-2.5 size-3.5 shrink-0 -translate-y-1/2 opacity-70"
        xmlns="http://www.w3.org/2000/svg"
        width="24" height="24" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" />
        <path d="M21 21l-6 -6" />
      </svg>

      <div class="absolute inset-y-0 right-2 left-8 flex items-center gap-2">
        {/* Combobox wrapper */}
        <div
          role="combobox"
          aria-expanded="false"
          aria-haspopup="listbox"
          aria-owns="search-suggestion-list"
          class="relative size-full overflow-visible bg-transparent"
        >
          <label for="commission-search-input" class="sr-only">
            {controls.searchCommissions}
          </label>

          <input
            id="commission-search-input"
            type="text"
            autocomplete="off"
            aria-label={controls.searchCommissions}
            placeholder={controls.searchPlaceholder}
            class="
              peer m-0 flex h-10 w-[calc(100%/0.875)] origin-left
              scale-[0.875] appearance-none rounded-md bg-transparent p-0
              pr-24 font-mono text-base/5 tracking-[0.01em] outline-none
              placeholder:text-gray-400
            "
          />

          {/* Suggestion dropdown (initially hidden, populated by JS) */}
          <ul
            id="search-suggestion-list"
            role="listbox"
            class="
              absolute inset-x-0 top-[calc(100%+0.5rem)] z-20 hidden max-h-[min(70vh,28rem)]
              overflow-y-auto overscroll-contain rounded-xl border border-white/20
              bg-white/80 py-1 text-sm shadow-[0_8px_30px_rgb(0,0,0,0.12)]
              backdrop-blur-md
              motion-reduce:animate-none
              dark:border-gray-700 dark:bg-black/80
            "
          />
        </div>

        {/* Help button + popover */}
        <button
          type="button"
          id="search-help-trigger"
          popovertarget="search-help-popover"
          class="
            absolute right-0 inline-flex size-7 items-center justify-center
            rounded-full text-gray-500 transition-[right,color]
            duration-200
            hover:text-gray-900
            focus-visible:outline-2 focus-visible:outline-offset-2
            focus-visible:outline-gray-500
            dark:text-gray-400
            dark:hover:text-gray-100
            dark:focus-visible:outline-gray-300
          "
          aria-label={controls.searchHelp}
        >
          {/* IconHelpCircle */}
          <svg
            class="size-5" xmlns="http://www.w3.org/2000/svg"
            width="24" height="24" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" />
            <path d="M12 16v.01" />
            <path d="M12 13a2 2 0 0 0 .914 -3.782a1.98 1.98 0 0 0 -2.414 .483" />
          </svg>
        </button>

        <div
          id="search-help-popover"
          popover
          class="
            w-[min(calc(100vw-1rem),26rem)] border-gray-300/80 bg-white/95 p-0
            text-gray-700 rounded-xl border shadow-lg
            md:text-base
            dark:border-gray-700 dark:bg-black/90 dark:text-gray-300
          "
          data-help-content
        />

        {/* Copy search URL button */}
        <button
          type="button"
          id="search-copy-url"
          class="
            absolute right-8 inline-flex size-7 items-center justify-center
            rounded-full transition-[opacity,color] duration-150
            focus-visible:outline-2 focus-visible:outline-offset-2
            focus-visible:outline-gray-500
            dark:focus-visible:outline-gray-300
            text-gray-500 hover:text-gray-900
            dark:text-gray-400 dark:hover:text-gray-100
            pointer-events-none opacity-0
          "
          aria-label={controls.copySearchUrl}
        >
          {/* IconShare3 */}
          <svg
            class="size-4.5" xmlns="http://www.w3.org/2000/svg"
            width="24" height="24" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round"
            aria-hidden="true"
            data-icon="share"
          >
            <path d="M13 4v4c-6.575 1.028 -9.02 6.788 -10 12c-.037 .206 5.384 -5.962 10 -6v4l8 -7l-8 -7z" />
          </svg>
          {/* IconCheck (hidden by default, shown on copy success) */}
          <svg
            class="size-4.5 hidden"
            xmlns="http://www.w3.org/2000/svg"
            width="24" height="24" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2.2"
            stroke-linecap="round" stroke-linejoin="round"
            aria-hidden="true"
            data-icon="check"
          >
            <path d="M5 12l5 5l10 -10" />
          </svg>
        </button>

        {/* Clear search button */}
        <button
          type="button"
          id="search-clear"
          class="
            absolute right-0 inline-flex size-7 items-center justify-center
            rounded-full text-gray-500 transition-[opacity,color]
            hover:text-gray-900
            focus-visible:outline-2 focus-visible:outline-offset-2
            focus-visible:outline-gray-500
            dark:text-gray-400
            dark:hover:text-gray-100
            dark:focus-visible:outline-gray-300
            pointer-events-none opacity-0
          "
          aria-label={controls.clearSearch}
        >
          {/* IconX */}
          <svg
            class="size-5" xmlns="http://www.w3.org/2000/svg"
            width="24" height="24" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2.2"
            stroke-linecap="round" stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6l-12 12" />
            <path d="M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  </div>

  {/* Popular keywords row */}
  <div
    id="search-popular-keywords"
    class="mt-2 flex min-h-8 w-full items-center gap-2 overflow-hidden pr-2 text-xs text-gray-500 dark:text-gray-400 hidden"
  >
    <ul
      id="search-keyword-list"
      class="flex min-w-0 flex-1 flex-nowrap items-center gap-1.5 overflow-x-auto pr-0.5"
    />
    <div class="flex shrink-0 gap-1.5">
      {/* Surprise me button */}
      <button
        type="button"
        id="search-shuffle"
        class="
          size-7 shrink-0 rounded-full border border-gray-200/80 bg-white/70
          text-gray-500 shadow-[0_1px_2px_rgba(0,0,0,0.04)]
          transition-[color,border-color,background-color,box-shadow] duration-200
          hover:border-gray-400 hover:bg-white hover:text-gray-900
          hover:shadow-[0_4px_14px_rgba(0,0,0,0.08)]
          dark:border-gray-700 dark:bg-black/35 dark:text-gray-400
          dark:hover:border-gray-500 dark:hover:bg-black/55
          dark:hover:text-gray-100 dark:hover:shadow-[0_4px_14px_rgba(0,0,0,0.22)]
        "
        aria-label={controls.shuffleRandomEntryLabel}
      >
        {/* IconArrowsShuffle */}
        <svg
          class="size-4 mx-auto" xmlns="http://www.w3.org/2000/svg"
          width="24" height="24" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="1.85"
          stroke-linecap="round" stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M18 4l3 3l-3 3" />
          <path d="M18 20l3 -3l-3 -3" />
          <path d="M3 7h3a5 5 0 0 1 5 5a5 5 0 0 0 5 5h5" />
          <path d="M21 7h-5a4.978 4.978 0 0 0 -3 1m-4 8a4.984 4.984 0 0 1 -3 1h-3" />
        </svg>
      </button>

      {/* Rotate keywords button */}
      <button
        type="button"
        id="search-rotate"
        class="
          size-7 shrink-0 rounded-full border border-gray-200/80 bg-white/70
          text-gray-500 shadow-[0_1px_2px_rgba(0,0,0,0.04)]
          transition-[color,border-color,background-color,box-shadow]
          duration-200
          hover:border-gray-400 hover:bg-white hover:text-gray-900
          hover:shadow-[0_4px_14px_rgba(0,0,0,0.08)]
          dark:border-gray-700 dark:bg-black/35 dark:text-gray-400
          dark:hover:border-gray-500 dark:hover:bg-black/55
          dark:hover:text-gray-100
          dark:hover:shadow-[0_4px_14px_rgba(0,0,0,0.22)]
        "
        aria-label={controls.refreshPopularSearchLabel}
      >
        <span id="search-rotate-icon" class="inline-flex origin-center motion-reduce:transform-none mx-auto">
          {/* IconRefresh */}
          <svg
            class="size-4" xmlns="http://www.w3.org/2000/svg"
            width="24" height="24" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="1.85"
            stroke-linecap="round" stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" />
            <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
          </svg>
        </span>
      </button>
    </div>
  </div>

  {/* Live region for screen readers */}
  <p id="search-live-region" aria-live="polite" class="sr-only"></p>
</section>

<script>
  import { initSearchController } from '@features/home/search/commissionSearchController'

  // Match client:idle behavior — initialize when browser is idle
  const init = () => {
    const root = document.getElementById('commission-search')
    if (root) initSearchController(root)
  }

  if ('requestIdleCallback' in window) {
    requestIdleCallback(init)
  }
  else {
    setTimeout(init, 1)
  }
</script>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/home/search/CommissionSearchIsland.astro
git commit -m "feat(search): add Astro template for search island"
```

---

## Task 12: Create the search controller

The controller wires all modules together: reads config from `data-*` attributes, initializes the store, binds event listeners, and triggers state updates. This replaces the orchestration previously done by React's render cycle and hooks.

**Files:**

- Create: `apps/web/src/features/home/search/commissionSearchController.ts`

- [ ] **Step 1: Create `commissionSearchController.ts`**

This is the entry point called from `CommissionSearchIsland.astro`'s `<script>`. It must:

1. Parse props from `data-*` attributes
2. Initialize the store
3. Subscribe to view mode and panel state changes
4. Bind input events (typing, focus, pointer)
5. Bind button events (clear, copy, help, shuffle, rotate)
6. Initialize the keyboard controller
7. Set up the render loop (store subscribe → recompute model → sync DOM → update dropdown)
8. Fetch the search index

```ts
// apps/web/src/features/home/search/commissionSearchController.ts
import type { SearchSuggestionAliasGroup } from '@features/home/search/commissionSearchIndex'
import type { HomeSearchControls } from '@features/home/i18n/homeSearchControls'
import {
  getHomeCharacterBatchTotalCount,
  prefetchHomeCharacterBatches,
} from '@features/home/commission/batch/homeCharacterBatchClient'
import { readActiveCharactersLoadedBatchCount } from '@features/home/commission/loader/activeCharactersEvent'
import {
  requestArchivedCharactersLoad as dispatchArchivedCharactersLoad,
  readArchivedCharactersLoadedBatchCount,
} from '@features/home/commission/loader/archivedCharactersEvent'
import {
  buildPopularKeywordPoolFromEntries,
  buildSearchEntriesFromDom,
  collapseAliasKeywordVariants,
  dedupeKeywords,
  ensureHomeSearchEntriesPromise,
  getCachedHomeSearchEntries,
  getPopularKeywordBatch,
  loadDeferredEntryBatch,
  MAX_FEATURED_KEYWORDS,
  MAX_VISIBLE_POPULAR_KEYWORDS,
  pickWeightedEntry,
  scrollAndAnimateEntry,
} from '@features/home/search/commissionSearchDeferred'
import { createDomSyncRefs, syncDom } from '@features/home/search/commissionSearchDomSync'
import {
  getDropdownItemCount,
  renderDropdown,
} from '@features/home/search/commissionSearchDropdownRenderer'
import { renderHelpContent } from '@features/home/search/commissionSearchHelpRenderer'
import { createListboxController } from '@features/home/search/commissionSearchKeyboard'
import {
  computeSearchModel,
  dispatchSearchQueryLocationChange,
  getUrlQuerySnapshot,
  resetModelState,
  subscribeToUrlQuerySnapshot,
} from '@features/home/search/commissionSearchModel'
import {
  readPanelLoadedState,
  subscribePanelState,
} from '@features/home/search/commissionSearchPanelState'
import { createSuggestionPanelController } from '@features/home/search/commissionSearchSuggestions'
import { readViewMode, subscribeViewMode } from '@features/home/search/commissionViewMode'
import { jumpToCommissionSearch } from '@lib/navigation/jumpToCommissionSearch'
import {
  applySuggestionToQuery,
  normalizeQuery,
  normalizeQuotedTokenBoundary,
} from '@lib/search/index'
import { createEmptySearchIndex } from '@features/home/search/commissionSearchIndex'

function shouldUseTapLikeFocus() {
  const hasTouchPoints = navigator.maxTouchPoints > 0
  const hasCoarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false
  return hasTouchPoints || hasCoarsePointer
}

function buildSearchUrl(rawQuery: string) {
  const url = new URL(window.location.href)
  if (normalizeQuery(rawQuery)) url.searchParams.set('q', rawQuery)
  else url.searchParams.delete('q')
  return url.toString()
}

function clearSearchQueryParamInAddress() {
  const url = new URL(window.location.href)
  url.searchParams.delete('q')
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  dispatchSearchQueryLocationChange()
}

export function initSearchController(root: HTMLElement) {
  // ==================== Parse props from data attributes ====================
  const locale = root.dataset.locale ?? undefined
  const featuredKeywords: string[] = JSON.parse(root.dataset.featuredKeywords ?? '[]')
  const suggestionAliasGroups: SearchSuggestionAliasGroup[] = JSON.parse(
    root.dataset.suggestionAliasGroups ?? '[]',
  )
  const controls: HomeSearchControls = JSON.parse(root.dataset.controls ?? '{}')

  // ==================== DOM references ====================
  const inputEl = root.querySelector<HTMLInputElement>('#commission-search-input')!
  const dropdownEl = root.querySelector<HTMLUListElement>('#search-suggestion-list')!
  const comboboxEl = inputEl.closest('[role="combobox"]') as HTMLElement
  const liveEl = root.querySelector<HTMLElement>('#search-live-region')!
  const helpTriggerEl = root.querySelector<HTMLButtonElement>('#search-help-trigger')!
  const helpPopoverEl = root.querySelector<HTMLElement>('#search-help-popover')!
  const copyUrlBtn = root.querySelector<HTMLButtonElement>('#search-copy-url')!
  const clearBtn = root.querySelector<HTMLButtonElement>('#search-clear')!
  const keywordListEl = root.querySelector<HTMLUListElement>('#search-keyword-list')!
  const keywordRowEl = root.querySelector<HTMLElement>('#search-popular-keywords')!
  const shuffleBtn = root.querySelector<HTMLButtonElement>('#search-shuffle')!
  const rotateBtn = root.querySelector<HTMLButtonElement>('#search-rotate')!
  const rotateIconEl = root.querySelector<HTMLElement>('#search-rotate-icon')!

  // ==================== State ====================
  let query = ''
  let inputQuery: string | null = null
  let isIndexReady = false
  let shouldWarmFuse = false
  let isSuggestionPanelDismissed = false
  let activeCommandValue = ''
  let externalEntries = getCachedHomeSearchEntries()
  let popularKeywordPage = 0
  let hasDismissedFeaturedKeywords = false
  let popularKeywordPool: string[] = externalEntries
    ? buildPopularKeywordPoolFromEntries(externalEntries)
    : []
  let matchedIds = new Set<number>()
  let copyState: 'idle' | 'success' = 'idle'
  let copyResetTimer: ReturnType<typeof setTimeout> | null = null
  let mode = readViewMode()
  let panelState = readPanelLoadedState()
  let lastShuffledId: number | null = null
  let didAutoJump = false
  let prefetchedActive = false
  let prefetchedArchived = false

  const domSyncRefs = createDomSyncRefs()
  domSyncRefs.liveElement = liveEl

  resetModelState()

  // ==================== Derived state computation ====================
  function recompute() {
    const initialUrlQuery = getUrlQuerySnapshot()
    const effectiveQuery = inputQuery ?? initialUrlQuery

    // Auto-jump on initial URL query
    if (!didAutoJump && initialUrlQuery) {
      didAutoJump = true
      isIndexReady = true
      shouldWarmFuse = true
      requestAnimationFrame(() => jumpToCommissionSearch({ focusMode: 'none' }))
    }

    query = effectiveQuery

    // Popular keywords
    const dedupedFeatured = dedupeKeywords(featuredKeywords, MAX_FEATURED_KEYWORDS)
    const featuredBatch = collapseAliasKeywordVariants(
      dedupedFeatured,
      suggestionAliasGroups,
      popularKeywordPage ^ 0x9e3779b9,
    )
    const shouldUseFeatured = !hasDismissedFeaturedKeywords && featuredBatch.length > 0
    const dedupedPool = collapseAliasKeywordVariants(
      popularKeywordPool,
      suggestionAliasGroups,
      popularKeywordPage,
    )
    const popularKeywords = shouldUseFeatured
      ? featuredBatch.slice(0, MAX_VISIBLE_POPULAR_KEYWORDS)
      : getPopularKeywordBatch(dedupedPool, popularKeywordPage, MAX_VISIBLE_POPULAR_KEYWORDS)

    // Search model
    const model = computeSearchModel({
      query: effectiveQuery,
      mode,
      panelState,
      externalEntries: externalEntries ?? undefined,
      isIndexReady,
      shouldWarmFuse,
      isSuggestionPanelDismissed,
      activeCommandValue,
      controls,
      suggestionAliasGroups,
      disableDomFiltering: false,
      suppressInitialSuggestionPanelAnimation: false,
    })

    matchedIds = model.matchedIds

    // DOM sync
    const statusMessage = model.shouldShowHiddenArchivedNotice
      ? `${model.visibleStatusMessage} ${model.hiddenArchivedNoticeMessage}`
      : model.visibleStatusMessage

    syncDom(
      {
        disableDomFiltering: false,
        hasDeferredQuery: model.hasDeferredQuery,
        hiddenArchivedMatchedCount: model.hiddenArchivedMatchedCount,
        matchedIds: model.matchedIds,
        resolvedIndex: model.resolvedIndex,
        archivedBatchCount: panelState.archivedBatchCount,
        archivedVisible: panelState.archivedVisible,
        statusMessage,
        visibleEntriesCount: model.visibleEntriesCount,
      },
      domSyncRefs,
    )

    // Update button visibility
    const hasQuery = model.hasQuery
    helpTriggerEl.style.right = hasQuery ? '4rem' : '0'
    copyUrlBtn.classList.toggle('pointer-events-none', !hasQuery)
    copyUrlBtn.classList.toggle('opacity-0', !hasQuery)
    clearBtn.classList.toggle('pointer-events-none', !hasQuery)
    clearBtn.classList.toggle('opacity-0', !hasQuery)

    // Update combobox ARIA
    comboboxEl.setAttribute('aria-expanded', model.shouldShowSuggestionPanel ? 'true' : 'false')

    // Update suggestion dropdown
    if (model.shouldShowSuggestionPanel) {
      dropdownEl.classList.remove('hidden')
      if (model.shouldAnimateSuggestionPanel) {
        dropdownEl.classList.add(
          'motion-safe:transition-transform',
          'motion-safe:duration-150',
          'motion-safe:ease-out',
        )
      }
      renderDropdown({
        container: dropdownEl,
        suggestionViewModels: model.suggestionViewModels,
        suggestionIsExclusion: model.suggestionIsExclusion,
        suggestionOperator: model.suggestionOperator,
        sourcePrefix: controls.sourcePrefix,
        shouldShowHiddenArchivedNotice: model.shouldShowHiddenArchivedNotice,
        hiddenArchivedNoticeMessage: model.hiddenArchivedNoticeMessage,
        visibleStatusMessage: model.visibleStatusMessage,
        loadArchivedCharactersLabel: controls.loadArchivedCharacters,
        onSelectSuggestion: applySuggestionHandler,
        onLoadArchivedCharacters: () => {
          dispatchArchivedCharactersLoad(window, { strategy: 'all', preserveScroll: true })
        },
      })
      listboxCtrl.reset()
    } else {
      dropdownEl.classList.add('hidden')
      dropdownEl.innerHTML = ''
    }

    // Prefetch archived batches when notice shows
    if (model.shouldShowHiddenArchivedNotice && !prefetchedArchived) {
      prefetchDeferredBatches('archived')
    }

    // Update popular keywords row
    renderPopularKeywords(popularKeywords)
  }

  // ==================== Popular keywords rendering ====================
  function renderPopularKeywords(keywords: string[]) {
    if (keywords.length === 0) {
      keywordRowEl.classList.add('hidden')
      return
    }

    keywordRowEl.classList.remove('hidden')
    keywordListEl.innerHTML = ''

    keywords.forEach((keyword, index) => {
      const li = document.createElement('li')
      li.className = `shrink-0${index >= 4 ? ' hidden lg:block' : ''}`

      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = `
        rounded-full border border-gray-300/80 bg-white/75 px-2.5 py-1
        font-mono text-[11px] tracking-[0.01em] text-gray-700
        transition-colors
        hover:border-gray-400 hover:text-gray-900
        focus-visible:outline-2 focus-visible:outline-offset-2
        focus-visible:outline-gray-500
        dark:border-gray-700 dark:bg-black/40 dark:text-gray-300
        dark:hover:border-gray-500 dark:hover:text-gray-100
      `.trim()
      btn.textContent = keyword
      btn.addEventListener('pointerdown', prepareSearchInteraction)
      btn.addEventListener('click', () => applyPopularKeyword(keyword))

      li.appendChild(btn)
      keywordListEl.appendChild(li)
    })
  }

  // ==================== Listbox keyboard controller ====================
  const listboxCtrl = createListboxController({
    inputEl,
    listEl: dropdownEl,
    getItemCount: () => getDropdownItemCount(dropdownEl),
    onSelect: index => {
      const items = dropdownEl.querySelectorAll<HTMLElement>('[role="option"]')
      const item = items[index]
      if (!item) return
      const value = item.dataset.value
      if (!value) return
      if (value === '__load-archived__') {
        dispatchArchivedCharactersLoad(window, { strategy: 'all', preserveScroll: true })
      } else {
        applySuggestionHandler(value)
      }
    },
    onDismiss: dismissSuggestionPanel,
  })

  // ==================== Suggestion panel controller ====================
  const suggestionCtrl = createSuggestionPanelController(inputEl)

  function showSuggestionPanel() {
    isSuggestionPanelDismissed = false
    suggestionCtrl.bindOutsideListeners(root, dismissSuggestionPanel)
    scheduleRecompute()
  }

  function dismissSuggestionPanel() {
    isSuggestionPanelDismissed = true
    activeCommandValue = ''
    suggestionCtrl.unbindOutsideListeners()
    scheduleRecompute()
  }

  function applySuggestionHandler(term: string) {
    const nextQuery = applySuggestionToQuery(query, term)
    dismissSuggestionPanel()
    inputQuery = nextQuery
    inputEl.value = nextQuery
    const cursor = nextQuery.length
    inputEl.setSelectionRange(cursor, cursor)
    copyState = 'idle'
    suggestionCtrl.focusInputAfterSelection(nextQuery)
    scheduleRecompute()
  }

  function applyPopularKeyword(keyword: string) {
    const nextQuery = applySuggestionToQuery('', keyword)
    if (!nextQuery.trim()) return
    ensureSearchRuntimeReady()
    dismissSuggestionPanel()
    inputQuery = nextQuery
    inputEl.value = nextQuery
    const cursor = nextQuery.length
    inputEl.setSelectionRange(cursor, cursor)
    copyState = 'idle'
    if (!shouldUseTapLikeFocus()) {
      suggestionCtrl.focusInputAfterSelection(nextQuery, { preventScroll: true })
    }
    scheduleRecompute()
  }

  // ==================== Interaction helpers ====================
  function ensureSearchRuntimeReady() {
    isIndexReady = true
    shouldWarmFuse = true
  }

  function prepareSearchInteraction() {
    ensureSearchRuntimeReady()
    prefetchDeferredBatches('active')
  }

  function prefetchDeferredBatches(status: 'active' | 'archived') {
    if (mode !== 'character') return
    if (status === 'active' && prefetchedActive) return
    if (status === 'archived' && prefetchedArchived) return

    const totalBatchCount = getHomeCharacterBatchTotalCount({ doc: document, status })
    if (totalBatchCount <= 0) return

    const startBatchIndex =
      status === 'active'
        ? readActiveCharactersLoadedBatchCount(document)
        : readArchivedCharactersLoadedBatchCount(document)
    const targetBatchIndex = totalBatchCount - 1

    if (status === 'active') prefetchedActive = true
    else prefetchedArchived = true

    if (targetBatchIndex < startBatchIndex) return

    prefetchHomeCharacterBatches({
      doc: document,
      startBatchIndex,
      status,
      targetBatchIndex,
    })
  }

  // ==================== Deferred recompute (replaces useDeferredValue) ====================
  let recomputeScheduled = false

  function scheduleRecompute() {
    if (recomputeScheduled) return
    recomputeScheduled = true
    requestAnimationFrame(() => {
      recomputeScheduled = false
      recompute()
    })
  }

  // ==================== Event bindings ====================

  // Input events
  inputEl.addEventListener('pointerdown', prepareSearchInteraction)
  inputEl.addEventListener('focus', () => {
    prepareSearchInteraction()
    if (suggestionCtrl.shouldSuppressInputFocusOpen()) return
    showSuggestionPanel()
  })
  inputEl.addEventListener('input', () => {
    ensureSearchRuntimeReady()
    inputQuery = normalizeQuotedTokenBoundary(inputEl.value)
    showSuggestionPanel()
    copyState = 'idle'
    scheduleRecompute()
  })

  listboxCtrl.bind()

  // Clear button
  clearBtn.addEventListener('click', () => {
    inputQuery = ''
    inputEl.value = ''
    showSuggestionPanel()
    copyState = 'idle'
    clearSearchQueryParamInAddress()
    if (!shouldUseTapLikeFocus()) {
      inputEl.focus()
    }
    scheduleRecompute()
  })

  // Copy URL button
  copyUrlBtn.addEventListener('click', async () => {
    if (!normalizeQuery(query)) return

    try {
      await navigator.clipboard.writeText(buildSearchUrl(query))
      copyState = 'success'
      const shareIcon = copyUrlBtn.querySelector('[data-icon="share"]')
      const checkIcon = copyUrlBtn.querySelector('[data-icon="check"]')
      shareIcon?.classList.add('hidden')
      checkIcon?.classList.remove('hidden')
      copyUrlBtn.classList.add('text-emerald-600', 'dark:text-emerald-400')
      copyUrlBtn.classList.remove(
        'text-gray-500',
        'hover:text-gray-900',
        'dark:text-gray-400',
        'dark:hover:text-gray-100',
      )
      copyUrlBtn.setAttribute('aria-label', controls.searchUrlCopied)
      liveEl.textContent = controls.searchUrlCopied

      if (copyResetTimer) clearTimeout(copyResetTimer)
      copyResetTimer = setTimeout(() => {
        copyState = 'idle'
        shareIcon?.classList.remove('hidden')
        checkIcon?.classList.add('hidden')
        copyUrlBtn.classList.remove('text-emerald-600', 'dark:text-emerald-400')
        copyUrlBtn.classList.add(
          'text-gray-500',
          'hover:text-gray-900',
          'dark:text-gray-400',
          'dark:hover:text-gray-100',
        )
        copyUrlBtn.setAttribute('aria-label', controls.copySearchUrl)
      }, 1200)
    } catch {
      copyState = 'idle'
      liveEl.textContent = controls.searchUrlCopyFailed
    }
  })

  // Help popover
  helpTriggerEl.addEventListener('pointerdown', () => {
    isIndexReady = true
  })
  helpTriggerEl.addEventListener('focus', () => {
    isIndexReady = true
  })
  helpPopoverEl.addEventListener('toggle', event => {
    if ((event as ToggleEvent).newState === 'open') {
      renderHelpContent(
        helpPopoverEl.querySelector('[data-help-content]') ?? helpPopoverEl,
        controls,
      )
    }
  })

  // Shuffle
  shuffleBtn.addEventListener('click', () => {
    if (!externalEntries || externalEntries.length === 0) return

    const candidates =
      matchedIds.size > 0
        ? externalEntries.filter(entry => matchedIds.has(entry.id))
        : externalEntries

    if (candidates.length === 0) return

    const pool =
      candidates.length > 1 && lastShuffledId !== null
        ? candidates.filter(entry => entry.id !== lastShuffledId)
        : candidates

    const randomEntry = pickWeightedEntry(pool)
    lastShuffledId = randomEntry.id

    if (!randomEntry.domKey) return

    const element = document.querySelector<HTMLElement>(
      `[data-commission-search-key="${CSS.escape(randomEntry.domKey)}"]`,
    )
    if (element) {
      scrollAndAnimateEntry(element)
      return
    }

    const separatorIndex = randomEntry.domKey.indexOf('::')
    const sectionId = separatorIndex > 0 ? randomEntry.domKey.slice(0, separatorIndex) : ''
    if (!sectionId) return

    void loadDeferredEntryBatch(sectionId)
      .then(() => {
        window.requestAnimationFrame(() => {
          const loadedElement = document.querySelector<HTMLElement>(
            `[data-commission-search-key="${CSS.escape(randomEntry.domKey)}"]`,
          )
          if (loadedElement) scrollAndAnimateEntry(loadedElement)
        })
      })
      .catch(() => {})
  })

  // Rotate keywords
  rotateBtn.addEventListener('click', () => {
    hasDismissedFeaturedKeywords = true
    popularKeywordPage += 1

    // Refresh icon spin animation
    const icon = rotateIconEl
    icon.getAnimations?.().forEach(a => a.cancel())
    icon.animate?.([{ transform: 'rotate(0deg)' }, { transform: 'rotate(-360deg)' }], {
      duration: 650,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      iterations: 1,
    })

    scheduleRecompute()
  })

  // ==================== External state subscriptions ====================
  subscribeViewMode(newMode => {
    mode = newMode
    prefetchedActive = false
    prefetchedArchived = false
    scheduleRecompute()
  })

  subscribePanelState(newState => {
    panelState = newState
    scheduleRecompute()
  })

  subscribeToUrlQuerySnapshot(() => {
    scheduleRecompute()
  })

  // ==================== Initialize ====================

  // Load initial entries from DOM
  if (!externalEntries) {
    const domEntries = buildSearchEntriesFromDom()
    if (domEntries.length > 0) {
      externalEntries = domEntries
      popularKeywordPool = buildPopularKeywordPoolFromEntries(domEntries)
    }
  }

  // Fetch external search index
  void ensureHomeSearchEntriesPromise()
    .then(entries => {
      externalEntries = entries
      popularKeywordPool = buildPopularKeywordPoolFromEntries(entries)
      scheduleRecompute()
    })
    .catch(error => {
      console.error(error)
    })

  // Initial render
  scheduleRecompute()
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/home/search/commissionSearchController.ts
git commit -m "feat(search): add vanilla search controller wiring all modules together"
```

---

## Task 13: Update HomePage.astro

Replace the React island import with the new Astro component.

**Files:**

- Modify: `apps/web/src/features/home/pages/HomePage.astro`

- [ ] **Step 1: Replace the import and usage**

Change the import at line 18:

```diff
-import CommissionSearchDeferred from '@features/home/search/CommissionSearchDeferred'
+import CommissionSearchIsland from '@features/home/search/CommissionSearchIsland.astro'
```

Change the usage at lines 195–199:

```diff
-      <CommissionSearchDeferred
-        client:idle
-        locale={resolvedLocale}
-        featuredKeywords={featuredSearchKeywords}
-        suggestionAliasGroups={suggestionAliasGroups}
-      />
+      <CommissionSearchIsland
+        locale={resolvedLocale}
+        featuredKeywords={featuredSearchKeywords}
+        suggestionAliasGroups={suggestionAliasGroups}
+      />
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/home/pages/HomePage.astro
git commit -m "refactor(search): switch HomePage to Astro search island"
```

---

## Task 14: Remove React files, UI library, and infrastructure

Delete all React files that are no longer needed.

**Files:**

- Delete: All files listed in spec section 10

- [ ] **Step 1: Delete React search components and hooks**

```bash
git rm apps/web/src/features/home/search/CommissionSearchDeferred.tsx
git rm apps/web/src/features/home/search/CommissionSearch.tsx
git rm apps/web/src/features/home/search/CommissionSearchHelpPopover.tsx
git rm apps/web/src/features/home/search/CommissionSearchSuggestionDropdown.tsx
git rm apps/web/src/features/home/search/PopularKeywordsRow.tsx
git rm apps/web/src/features/home/search/SurpriseMe.tsx
git rm apps/web/src/features/home/search/useCommissionSearchModel.ts
git rm apps/web/src/features/home/search/useCommissionSearchDomSync.ts
git rm apps/web/src/features/home/search/useSearchPanelLoadedState.ts
git rm apps/web/src/features/home/search/useSuggestionPanelController.ts
git rm apps/web/src/features/home/commission/CommissionViewMode.tsx
```

- [ ] **Step 2: Delete UI library components**

```bash
git rm apps/web/src/components/ui/button.tsx
git rm apps/web/src/components/ui/command.tsx
git rm apps/web/src/components/ui/popover.tsx
git rm apps/web/src/components/ui/select.tsx
git rm apps/web/src/components/ui/tabs.tsx
git rm apps/web/src/components/ui/alert-dialog.tsx
```

- [ ] **Step 3: Delete React infrastructure**

```bash
git rm apps/web/src/config/astroReactServerShim.ts
```

- [ ] **Step 4: Delete old React test files**

```bash
git rm apps/web/src/features/home/search/CommissionSearch.test.tsx
git rm apps/web/src/features/home/search/PopularKeywordsRow.test.tsx
git rm apps/web/src/features/home/search/CommissionSearchDeferred.test.tsx
git rm apps/web/src/features/home/commission/CommissionViewMode.test.tsx
git rm apps/web/src/features/home/search/useCommissionSearchModel.test.ts
```

- [ ] **Step 5: Commit**

```bash
git commit -m "refactor(search): remove all React components, hooks, UI library, and server shim"
```

---

## Task 15: Remove React dependencies and clean up config

Remove all React-related packages and strip the Astro config.

**Files:**

- Modify: `apps/web/package.json`
- Modify: `apps/web/astro.config.ts`

- [ ] **Step 1: Remove dependencies from package.json**

Remove from `dependencies`:

- `react`, `react-dom`
- `@radix-ui/react-alert-dialog`, `@radix-ui/react-popover`, `@radix-ui/react-select`, `@radix-ui/react-slot`, `@radix-ui/react-tabs`
- `@tabler/icons-react`, `cmdk`, `class-variance-authority`

Remove from `devDependencies`:

- `@astrojs/react`, `@testing-library/react`

Keep: `clsx`, `tailwind-merge`, `fuse.js` (still used)

- [ ] **Step 2: Clean up astro.config.ts**

Remove:

- Line 3: `import react from '@astrojs/react'`
- Line 55: `react()` from `integrations` array → becomes `integrations: [assetsPipelineIntegration()]`
- Lines 62: `'@astrojs/react/server.js'` Vite alias → delete the entire `alias` block
- Lines 73-74: `@radix-ui` and `cmdk` chunk rules → simplify `manualChunks` to only keep `fuse.js`

Updated config:

```ts
import type { AstroUserConfig } from 'astro'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, fontProviders } from 'astro/config'
import { assetsPipelineIntegration } from './server/assetsPipelineAstro'

type AstroVitePlugins = NonNullable<NonNullable<AstroUserConfig['vite']>['plugins']>

const vitePlugins: AstroVitePlugins = [tailwindcss() as unknown as AstroVitePlugins[number]]

export default defineConfig({
  output: 'static',
  cacheDir: '.astro',
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh-tw', 'ja'],
    routing: {
      prefixDefaultLocale: false,
      redirectToDefaultLocale: false,
    },
  },

  fonts: [
    // ... unchanged ...
  ],

  integrations: [assetsPipelineIntegration()],
  vite: {
    plugins: vitePlugins,
    resolve: {
      // @ts-expect-error Vite 6+ native option; Astro's bundled Vite types lag behind
      tsconfigPaths: true,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: id => {
            if (!id.includes('node_modules')) return
            if (id.includes('fuse.js')) return 'vendor-search'
            return 'vendor'
          },
        },
      },
    },
  },
})
```

- [ ] **Step 3: Run `bun install` to update lockfile**

Run: `cd apps/web && bun install`

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json apps/web/astro.config.ts bun.lock
git commit -m "chore(web): remove React dependencies and clean up Astro config"
```

---

## Task 16: Check for remaining React references

Verify no stale imports or references to removed files remain.

- [ ] **Step 1: Grep for React imports across apps/web**

Run: `grep -rn "from 'react'" apps/web/src/ || echo "No React imports found"`
Run: `grep -rn "@astrojs/react" apps/web/ || echo "No @astrojs/react refs found"`
Run: `grep -rn "@radix-ui" apps/web/src/ || echo "No Radix refs found"`
Run: `grep -rn "@tabler/icons-react" apps/web/src/ || echo "No tabler refs found"`
Run: `grep -rn "from 'cmdk'" apps/web/src/ || echo "No cmdk refs found"`

Expected: All commands print "No ... found"

- [ ] **Step 2: Check for imports of deleted files**

Run: `grep -rn "CommissionSearchDeferred" apps/web/src/ || echo "Clean"`
Run: `grep -rn "useCommissionSearchModel" apps/web/src/ || echo "Clean"`
Run: `grep -rn "useCommissionSearchDomSync" apps/web/src/ || echo "Clean"`
Run: `grep -rn "useSearchPanelLoadedState" apps/web/src/ || echo "Clean"`
Run: `grep -rn "useSuggestionPanelController" apps/web/src/ || echo "Clean"`
Run: `grep -rn "astroReactServerShim" apps/web/src/ || echo "Clean"`
Run: `grep -rn "from '@components/ui/" apps/web/src/ || echo "Clean"`

Expected: All clean

- [ ] **Step 3: Fix any stale references found, then commit if changes were needed**

---

## Task 17: Build verification

Run the full validation pipeline to confirm everything compiles and passes.

- [ ] **Step 1: TypeScript check**

Run: `bun run typecheck`
Expected: No errors

- [ ] **Step 2: Lint**

Run: `bun run lint`
Expected: No errors (or only pre-existing ones)

- [ ] **Step 3: Build**

Run: `bun run build`
Expected: Build succeeds, outputs static HTML + JS chunks

- [ ] **Step 4: Unit tests**

Run: `bun run test`
Expected: All tests pass

- [ ] **Step 5: Compare bundle size**

Check the build output for JS chunk sizes. Expected:

- No `vendor-ui` chunk (Radix/cmdk removed)
- `vendor` chunk significantly smaller (no React/ReactDOM)
- Total client JS ~55-60 KB gzipped (down from ~101 KB)

- [ ] **Step 6: Commit any fixes needed during verification**

---

## Task 18: Visual regression testing

Run Playwright visual regression tests to confirm pixel-level consistency.

- [ ] **Step 1: Run visual regression tests**

Run: `bun run test:visual`
Expected: All screenshots match baseline (or very close — minor sub-pixel differences from framework removal are acceptable)

- [ ] **Step 2: If screenshots differ, inspect and update baselines**

If differences are only sub-pixel rendering changes (not structural):
Run: `bun run test:visual:update`

If differences are structural, go back and fix the Astro template or controller.

- [ ] **Step 3: Commit updated baselines if any**

```bash
git add -A tests/
git commit -m "test(visual): update baselines after React removal"
```

---

## Task 19: Remove cn utility if unused

Check whether `clsx` and `tailwind-merge` (via `cn`) are still used anywhere after removing the UI components.

- [ ] **Step 1: Check cn usage**

Run: `grep -rn "from '@lib/utils/cn'" apps/web/src/ || echo "cn unused"`

- [ ] **Step 2: If unused, delete `cn.ts` and remove `clsx`/`tailwind-merge` from package.json**

```bash
git rm apps/web/src/lib/utils/cn.ts
# Then remove clsx and tailwind-merge from package.json dependencies
```

- [ ] **Step 3: If still used elsewhere, leave as-is**

- [ ] **Step 4: Commit if changes were made**

---

## Task 20: Update CLAUDE.md

Update the project CLAUDE.md to reflect the architecture change.

**Files:**

- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the Home Page Architecture section**

Remove references to React islands. Update to describe the new vanilla TS search module. Remove mention of `CommissionSearchDeferred.tsx`. Update the search island description.

Key changes:

- Remove "React is only for the search island" — replace with "all client-side behavior uses vanilla TS modules"
- Remove `CommissionSearchDeferred.tsx` reference
- Update the dependency list (no more React)
- Remove the Astro 6 guardrail about `@astrojs/react`

- [ ] **Step 2: Update Tech Stack section**

Remove "React 19 islands (selective hydration)" from the public site stack.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md to reflect React removal from apps/web"
```
