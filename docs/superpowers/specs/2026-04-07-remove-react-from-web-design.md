# Remove React from apps/web

**Date:** 2026-04-07
**Status:** Approved
**Scope:** apps/web only — apps/admin is unaffected

## Goal

Eliminate React and its ecosystem from `apps/web`, replacing the single search island with vanilla TS + Astro templates. Zero functional, visual, or DOM-contract regression.

## Motivation

- **Bundle size:** React ecosystem accounts for ~54 KB gzipped (~58% of client JS). Removal drops total client JS from ~101 KB to ~55-60 KB gzipped.
- **Dependency simplification:** Remove 9+ npm packages (react, react-dom, @astrojs/react, 5× @radix-ui/\*, @tabler/icons-react, cmdk, class-variance-authority, @testing-library/react).
- **Architecture consistency:** `apps/web` already uses Astro + vanilla TS for all client behavior except the search island. This closes the gap.
- **Maintenance cost:** Eliminates custom React server shim (239 lines), Astro React integration config, and framework-specific chunk splitting.

## Constraints

- **C-level parity:** Function + visual + DOM contract must be identical. All `data-*` attributes, CSS classes, DOM hierarchy, and ID selectors must be preserved.
- **Accessibility:** Core keyboard navigation (arrow keys, Enter, Escape) and primary ARIA roles (combobox, listbox, option, aria-expanded, aria-activedescendant) must be kept. Fine-grained ARIA attributes from cmdk/Radix may be simplified where the effort is disproportionate.
- **Migration strategy:** One-shot replacement (Approach 1). No incremental migration or parallel builds.

## Current State

### React entry point

`HomePage.astro` renders one React island:

```astro
<CommissionSearchDeferred
  client:idle
  locale={resolvedLocale}
  featuredKeywords={featuredSearchKeywords}
  suggestionAliasGroups={suggestionAliasGroups}
/>
```

### File inventory (to be replaced or deleted)

**Search components (11 files, ~2,600 lines):**

| File                                     | Lines | Category                           |
| ---------------------------------------- | ----- | ---------------------------------- |
| `CommissionSearchDeferred.tsx`           | 535   | Mixed — 60% pure logic extractable |
| `CommissionSearch.tsx`                   | 604   | Mostly React glue                  |
| `CommissionSearchSuggestionDropdown.tsx` | 207   | Pure presentation                  |
| `CommissionSearchHelpPopover.tsx`        | 168   | Pure presentation                  |
| `PopularKeywordsRow.tsx`                 | 148   | Mostly React glue                  |
| `SurpriseMe.tsx`                         | 31    | Pure presentation                  |
| `useCommissionSearchModel.ts`            | 545   | Mixed — 30% pure logic             |
| `useCommissionSearchDomSync.ts`          | 308   | Mixed — 40% pure logic             |
| `useSearchPanelLoadedState.ts`           | 164   | Mostly React glue                  |
| `useSuggestionPanelController.ts`        | 82    | React glue                         |
| `CommissionViewMode.tsx`                 | 34    | React glue                         |

**UI library (6 files, used by search):**

- `button.tsx` (71 lines) — used by search
- `command.tsx` (153 lines) — cmdk wrapper, used by search
- `popover.tsx` (34 lines) — used by search (help)
- `select.tsx` (142 lines) — NOT used by search, delete
- `tabs.tsx` (42 lines) — NOT used by search, delete
- `alert-dialog.tsx` (165 lines) — NOT used by search, delete

**Infrastructure:**

- `astroReactServerShim.ts` (239 lines) — custom React SSR shim
- React integration in `astro.config.ts` (import, integration array, Vite alias, manual chunks)

### Pure logic modules (unchanged)

These files have zero React dependency and remain as-is:

- `commissionSearchIndex.ts` — index building, entry collection, suggestion aggregation
- `homeSearchControls.ts` — locale labels
- `homeSearchEntries.ts` — entry type definitions

### Pure functions to extract from React files

These live inside React files but are framework-agnostic. Extract into standalone modules:

- `createSeededRandom()` — deterministic PRNG
- `shuffleKeywords()` — Fisher-Yates with seeded random
- `getPopularKeywordBatch()` — keyword rotation
- `collapseAliasKeywordVariants()` — alias deduplication
- `pickWeightedEntry()` — weighted random for surprise-me
- `areSetsEqual()` — set comparison utility
- `toggleHiddenClass()` — DOM class helper
- `syncEntryVisibility*()` — entry show/hide logic
- `syncSectionVisibility()` — section show/hide logic

## Design

### 1. Search UI structure

**Before:** React JSX renders the search shell at hydration time.

**After:** Astro template renders the full search HTML at build time. A vanilla TS controller attaches behavior via `<script>`.

File mapping:

| Before (React)                                              | After (Vanilla)                                                                        |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `CommissionSearchDeferred.tsx`                              | `CommissionSearchIsland.astro` (template) + `commissionSearchController.ts` (behavior) |
| `CommissionSearch.tsx`                                      | Split into Astro template (structure) and controller (behavior)                        |
| `HomePage.astro` `<CommissionSearchDeferred client:idle />` | `<CommissionSearchIsland />` (regular Astro component, no `client:*`)                  |

The Astro component receives the same props (`locale`, `featuredKeywords`, `suggestionAliasGroups`) and renders identical HTML. The `<script>` module initializes on `requestIdleCallback` to match the current `client:idle` timing.

### 2. State management

**Before:** React hooks (useState, useRef, useSyncExternalStore, useDeferredValue).

**After:** Lightweight event-driven store:

```ts
// commissionSearchStore.ts
type SearchState = {
  query: string
  parsedQuery: ParsedSearchQuery
  matchedIds: Set<string>
  suggestionIndex: number
  isDropdownOpen: boolean
  // ...
}

type Listener = () => void
let state: SearchState = {
  /* initial */
}
const listeners = new Set<Listener>()

export function getState(): SearchState {
  return state
}

export function setState(next: Partial<SearchState>) {
  Object.assign(state, next)
  for (const fn of listeners) fn()
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
```

`useDeferredValue` replacement: search index rebuild wrapped in `requestIdleCallback` (or `setTimeout(fn, 0)` fallback) so input remains responsive.

`useSyncExternalStore` replacement: `subscribe` + `getState` pattern — consumers call `subscribe` and read `getState()` in the callback.

### 3. cmdk replacement

**Before:** cmdk provides combobox semantics, keyboard navigation, item highlighting.

**After:** Native `<input>` + `<ul role="listbox">` with hand-written keyboard navigation.

Preserved ARIA contract:

- `role="combobox"` on input wrapper
- `role="listbox"` on suggestion list
- `role="option"` on each suggestion item
- `aria-expanded` on input
- `aria-activedescendant` pointing to highlighted item
- Arrow up/down cycles highlight, Enter selects, Escape closes

Not preserved: cmdk's internal virtual focus management and `aria-label` auto-generation (replaced with explicit static labels).

### 4. Radix UI replacement

| Radix component | Replacement                                                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Popover (help)  | Native `popover` attribute + `<button popovertarget="...">`. Fallback: `<details>`/`<summary>` if popover support is insufficient. |
| Alert Dialog    | Native `<dialog>` (not used by search — just delete)                                                                               |
| Select          | Not used by search — delete                                                                                                        |
| Tabs            | Not used by search — delete                                                                                                        |
| Slot            | Not needed without Radix — delete                                                                                                  |

### 5. Icon replacement

8 icons from `@tabler/icons-react` → inline SVG, either directly in the Astro template or as tiny Astro components (e.g., `IconSearch.astro`). Copy SVG paths from tabler-icons. Zero runtime dependency.

Icons to convert: `IconCheck`, `IconChevronDown`, `IconHelpCircle`, `IconSearch`, `IconShare3`, `IconX`, `IconArrowsShuffle`, `IconRefresh`.

### 6. DOM contract preservation

The following must remain identical:

- All `data-*` attributes (`data-stale-visibility`, `data-stale-loaded`, `data-commission-id`, etc.)
- All CSS class names used by `HomeClientScript.astro` and deferred batch loaders
- DOM hierarchy and nesting order
- Element IDs (`#commission-search`, etc.)
- `hidden` class toggle behavior for search filtering

Verification: Playwright visual regression tests before and after. Additionally, a manual DOM diff of the rendered HTML for the search section.

### 7. Deferred loading strategy

**Before:** `client:idle` → Astro downloads React chunk → hydrates island → island fetches search index.

**After:** Astro renders full search HTML at build time (no hydration needed). `<script>` module loads and initializes on `requestIdleCallback`:

1. Bind event listeners to pre-rendered DOM
2. Fetch `/search/home-search-entries.json` for search index
3. Initialize Fuse.js instance
4. Attach keyboard navigation

The deferred batch loading for character/timeline sections remains unchanged — it's already vanilla TS in `HomeClientScript.astro`.

### 8. Astro config cleanup

Remove from `astro.config.ts`:

- `import react from '@astrojs/react'`
- `react()` from `integrations` array
- `'@astrojs/react/server.js'` Vite alias
- `manualChunks` entries for `@radix-ui` and `cmdk` (keep `fuse.js` chunk if beneficial)

### 9. New file structure

```
src/features/home/search/
├── CommissionSearchIsland.astro       # template (replaces CommissionSearchDeferred + CommissionSearch JSX)
├── commissionSearchController.ts      # init + event binding (replaces hooks orchestration)
├── commissionSearchStore.ts           # state management (replaces useState/useRef)
├── commissionSearchKeyboard.ts        # keyboard nav for suggestion dropdown (replaces cmdk)
├── commissionSearchDomSync.ts         # DOM visibility sync (extracted from useCommissionSearchDomSync)
├── commissionSearchDeferred.ts        # deferred index loading + keyword rotation (extracted pure logic)
├── commissionSearchIndex.ts           # UNCHANGED — pure TS
├── commissionSearchSuggestions.ts     # suggestion panel show/hide/focus (replaces useSuggestionPanelController)
├── commissionViewMode.ts              # external store (replaces CommissionViewMode.tsx)
├── homeSearchControls.ts              # UNCHANGED — locale labels
├── homeSearchEntries.ts               # UNCHANGED — types
└── __tests__/
    ├── commissionSearchStore.test.ts
    ├── commissionSearchKeyboard.test.ts
    ├── commissionSearchDomSync.test.ts
    └── commissionSearchDeferred.test.ts
```

### 10. Files to delete

```
# React components
src/features/home/search/CommissionSearchDeferred.tsx
src/features/home/search/CommissionSearch.tsx
src/features/home/search/CommissionSearchHelpPopover.tsx
src/features/home/search/CommissionSearchSuggestionDropdown.tsx
src/features/home/search/PopularKeywordsRow.tsx
src/features/home/search/SurpriseMe.tsx
src/features/home/search/useCommissionSearchModel.ts
src/features/home/search/useCommissionSearchDomSync.ts
src/features/home/search/useSearchPanelLoadedState.ts
src/features/home/search/useSuggestionPanelController.ts
src/features/home/commission/CommissionViewMode.tsx

# UI library
src/components/ui/button.tsx
src/components/ui/command.tsx
src/components/ui/popover.tsx
src/components/ui/select.tsx
src/components/ui/tabs.tsx
src/components/ui/alert-dialog.tsx

# Infrastructure
src/config/astroReactServerShim.ts

# Tests (replaced by new tests)
src/features/home/search/__tests__/CommissionSearch.test.tsx
src/features/home/search/__tests__/CommissionSearchDeferred.test.tsx
src/features/home/search/__tests__/PopularKeywordsRow.test.tsx
src/features/home/commission/__tests__/CommissionViewMode.test.tsx
```

### 11. Dependencies to remove from package.json

```
react
react-dom
@astrojs/react
@radix-ui/react-alert-dialog
@radix-ui/react-popover
@radix-ui/react-select
@radix-ui/react-slot
@radix-ui/react-tabs
@tabler/icons-react
cmdk
class-variance-authority
@testing-library/react
```

### 12. Testing strategy

1. **Before migration:** Run `pnpm run test:visual` to capture baseline screenshots.
2. **Unit tests:** Rewrite in Vitest, testing vanilla TS modules directly (no `@testing-library/react`). Test store, keyboard nav, DOM sync, deferred loading.
3. **Visual regression:** Run `pnpm run test:visual` after migration — screenshot diff must show zero visible change.
4. **Manual verification checklist:**
   - [ ] Type in search box → results filter in real time
   - [ ] Arrow keys navigate suggestion dropdown
   - [ ] Enter selects suggestion, Escape closes dropdown
   - [ ] Help popover opens/closes
   - [ ] Popular keywords rotate, click applies keyword
   - [ ] Surprise me picks random entry and scrolls to it
   - [ ] Hash navigation works for deep links
   - [ ] Deferred batch loading works (active + stale sections)
   - [ ] View mode toggle (character/timeline) persists
   - [ ] Copy link button works
   - [ ] Search works after stale sections expand
5. **Build verification:** `pnpm run build` succeeds, `pnpm run typecheck` passes, `pnpm run lint` passes.

## Estimated output

~1,200–1,500 lines of vanilla TS + Astro templates, split across 7–8 focused modules. Net reduction of ~1,000+ lines from removing React abstraction overhead, UI library wrappers, and server shim.
