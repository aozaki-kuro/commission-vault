# home/search

React search island for the home page. Goals: stable first paint, precise filtering, minimal interaction regression.

## File Responsibilities

- `CommissionSearch.tsx` — search shell and state orchestration (query, index hydration, analytics, submodule assembly)
- `commissionSearchIndex.ts` — index construction, DOM context collection, suggestion aggregation (pure, no React)
- `useCommissionSearchDomSync.ts` — DOM filter sync, section/stale divider visibility, live region text
- `useCommissionSearchModel.ts` — query/index/suggestion derivation chain and search analytics
- `CommissionSearchSuggestionDropdown.tsx` — suggestion dropdown rendering (keep DOM structure, classes, `cmdk` semantics stable)
- `useSearchPanelLoadedState.ts` — subscribe to character/timeline panel load state (DOM reads + event bridge only)
- `useSuggestionPanelController.ts` — dropdown close, outside click, Escape, programmatic refocus suppression
- `CommissionSearchDeferred.tsx` — deferred index init wrapper (same output contract as main search)
- `PopularKeywordsRow.tsx` — keyword shortcut buttons (render + trigger only)

## Dependency Rules

- Hooks must not depend on `CommissionSearch.tsx`
- Pure render components must not read `window`/`document` directly
- `commissionSearchIndex.ts` has no React dependency
- Search algorithm comes from `#lib/search/index` — do not duplicate filtering rules in UI layer

## Modification Rules

- Keep search box, dropdown, and stale hint DOM structure + className stable — no layout jumps
- Any suggestion/stale/timeline interaction change requires regression test updates
- New state? Ask if it fits an existing hook before adding to `CommissionSearch.tsx`
- New pure derivation? Put it in `commissionSearchIndex.ts`, not a component
