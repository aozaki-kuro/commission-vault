# home/search

Vanilla TS search system for the home page. Goals: stable first paint, precise filtering, minimal interaction regression.

## File Responsibilities

- `CommissionSearchTemplate.astro` — search shell markup (input, dropdown, help popover, live region)
- `commissionSearchStore.ts` — reactive store (query, index, suggestions, view mode, panel states)
- `commissionSearchIndex.ts` — index construction, DOM context collection, suggestion aggregation (pure, no framework)
- `commissionSearchModel.ts` — query/index/suggestion derivation chain and search analytics
- `commissionSearchDomSync.ts` — DOM filter sync, section/stale divider visibility, live region text
- `commissionSearchDropdownRenderer.ts` — suggestion dropdown rendering (vanilla DOM, keyboard navigation)
- `commissionSearchHelpRenderer.ts` — help popover toggle and rendering
- `commissionSearchKeyboardNav.ts` — keyboard navigation for dropdown items
- `commissionSearchPanelLoadedState.ts` — subscribe to character/timeline panel load state (DOM reads + event bridge only)
- `commissionSearchSuggestionPanelController.ts` — dropdown close, outside click, Escape, programmatic refocus suppression
- `commissionSearchViewModeStore.ts` — view mode persistence (character/timeline toggle)
- `commissionSearchController.ts` — top-level controller that wires all modules together
- `homeSearchControls.ts` — locale label resolution for search UI

## Dependency Rules

- Modules must not create circular imports
- Pure logic modules must not read `window`/`document` directly (except DOM sync and renderers)
- `commissionSearchIndex.ts` has no framework dependency
- Search algorithm comes from `#lib/search/index` — do not duplicate filtering rules in UI layer

## Modification Rules

- Keep search box, dropdown, and stale hint DOM structure + className stable — no layout jumps
- Any suggestion/stale/timeline interaction change requires regression test updates
- New state? Put it in `commissionSearchStore.ts`
- New pure derivation? Put it in `commissionSearchIndex.ts`, not a renderer
