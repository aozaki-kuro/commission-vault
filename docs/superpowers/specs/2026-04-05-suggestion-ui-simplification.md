# Suggestion UI Simplification

**Date:** 2026-04-05
**Status:** Approved

## Goal

Consolidate the admin `/suggestion` page from three separate sections into a single cohesive panel. Reduce visual complexity and code size while preserving all existing functionality.

## Current State

- `AdminSuggestionDashboard.tsx`: 448 lines, three `<section>` blocks (featured list, manual input, keyword pool)
- `AdminSuggestionPage.tsx`: 152 lines (data loading — unchanged)
- Each section has its own card, title, and description text

## Design

Single card layout, top to bottom:

### 1. Header row

- Title: "Suggestion curation"
- Counter: `(X/6)` next to title
- Right side: `FormStatusIndicator` + `SaveButton`
- One-line description below title

### 2. Drag-sortable keyword list

- Same `SortableKeywordItem` component (grip + text + remove)
- Empty state: dashed border placeholder
- No changes to dnd-kit usage

### 3. Manual add row

- Inline: text input + "Add" button, no section heading
- Same validation (non-empty, under max, no dupes)

### 4. Collapsible keyword pool

- Toggle via `<details>`/`<summary>` (native HTML, no extra deps)
- Summary text: "Browse keyword pool"
- When open: search input + tag button grid
- All existing search/filter/toggle logic unchanged

### 5. Hidden form input + form wrapper

- `<form>` wraps the entire card
- Hidden `keywordsJson` input as before

## What Does NOT Change

- `AdminSuggestionPage.tsx` (data fetching, caching, loading/error states)
- API endpoints and data contract (`HomeSuggestionAdminData`)
- `@dnd-kit` dependency and drag-drop behavior
- Keyword normalization and deduplication logic
- Save → `markPendingRebuild()` flow
- Visual regression test file (route path unchanged)

## Expected Outcome

- `AdminSuggestionDashboard.tsx` reduced from ~448 to ~250 lines
- Single visual card instead of three separate sections
- Keyword pool hidden by default, available on demand
- No new dependencies
