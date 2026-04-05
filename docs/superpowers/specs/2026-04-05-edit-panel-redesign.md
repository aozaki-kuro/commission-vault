# Edit Panel Redesign

> Redesign the admin `/edit` page from inline full-form expansion to a thumbnail grid + drawer pattern, improving information density while preserving existing character accordion and drag-reorder behavior.

## Problem

The current edit panel expands each commission inline with a full-width image preview (1280:525 aspect) and 6 form fields stacked vertically. Expanding a single commission pushes all sibling entries off-screen, making multi-entry workflows tedious. Users must scroll extensively to switch between commissions within the same character.

A secondary pain point: there is no UI for batch keyword editing. Previously handled via local SQLite + CLI tooling, this capability was lost in the migration to remote D1.

## Design Decision

**Thumbnail Grid + Drawer (Option B)** was chosen over Master-Detail Split (Option A) because:

- A requires widening the container beyond `max-w-2xl`, forcing all other admin pages to adapt
- A requires a fundamentally different small-screen fallback
- B preserves the existing accordion mental model and character drag-reorder with minimal structural change
- B's drawer naturally becomes a bottom sheet on mobile via vaul's built-in behavior
- The user's workflow is linear (find one → edit → close → next), not comparative, so simultaneous list+detail visibility is unnecessary

## Scope

### In scope

1. Replace inline commission forms with a responsive thumbnail grid inside character accordion cards
2. Open commission edit form in a right-side shadcn Drawer (vaul) with frosted glass backdrop
3. Add a Keyword Find & Replace popover tool
4. Mobile adaptation (grid 2-col, drawer becomes bottom sheet)

### Out of scope

- Changes to the character card header (drag handle, rename, delete — keep as-is)
- Changes to the edit form fields themselves (same fields, same validation, same actions)
- Changes to other admin pages (overview, create, aliases, suggestion)
- Changes to the `max-w-2xl` container constraint
- New API endpoints (keyword replace uses existing PATCH endpoint per commission)

## Architecture

### Component Changes

```
Before:
  CommissionManager
    └── SortableCharacterCard
          └── CommissionEditForm[]  (inline, all expanded)

After:
  CommissionManager
    └── SortableCharacterCard
          └── CommissionThumbnailGrid  (NEW — compact grid of clickable thumbnails)
    └── CommissionEditDrawer  (NEW — vaul Drawer, renders CommissionEditForm inside)
    └── KeywordReplacePopover  (NEW — find/replace tool)
```

### New Dependencies

- `vaul` — shadcn Drawer primitive (bottom sheet on mobile, side drawer on desktop)

### Commission Thumbnail Grid

Replaces the current stacked `CommissionEditForm[]` inside each `SortableCharacterCard`.

- **Layout**: CSS grid, 3 columns at `max-w-2xl` container width, 2 columns on narrow screens
- **Each thumbnail card shows**:
  - Source image preview (same lazy-load pattern, same aspect ratio 1280:525)
  - File name (truncated with ellipsis)
  - Link count badge
  - Selected state: blue ring + highlighted label when this commission is open in the drawer
- **Interaction**: Click thumbnail → opens `CommissionEditDrawer` with that commission
- **Loading state**: Skeleton grid (same pattern as current `CommissionEditFormSkeleton`, but grid-sized)

Commission data loading remains unchanged — `fetchCharacterCommissionsAction` fires on accordion expand, thumbnails render from `commissionMap`.

### Commission Edit Drawer

A right-side drawer containing the existing `CommissionEditForm` component.

- **Primitive**: shadcn Drawer (vaul) configured for right-side on desktop
- **Backdrop**: Frosted glass — `bg-black/15 backdrop-blur-sm` (consistent with existing `CharacterDeleteDialog` overlay style)
- **Drawer panel**: White background, left border-radius, scrollable body
- **Header**: Commission file name + character name subtitle + close button
- **Body**: Existing `CommissionEditForm` component, unchanged
- **Mobile behavior**: vaul automatically renders as a bottom sheet with drag-to-dismiss handle — no additional code needed
- **State**: Drawer open/close state lives in `CommissionManager`. Selected commission ID stored in state. Closing the drawer clears selection. `onSaveSuccess` and `onDelete` callbacks update the parent commission list as they do today.
- **Keyboard**: Escape closes drawer (vaul default). Focus trap within drawer (vaul default).

### Keyword Find & Replace

A popover tool accessible from a button next to the search bar.

- **Trigger**: "Keyword Replace" button, styled as a secondary action
- **Popover contents**:
  - "Find" text input
  - "Replace with" text input
  - Match preview list: shows each commission that contains the find term in its `keyword` field, with before → after preview
  - "Replace all" button + "Cancel" button
- **Matching logic**: Case-insensitive substring match within comma-separated keyword values. Replaces the matched substring, preserves other keywords and comma structure.
- **Execution**: Iterates matched commissions sequentially, calls existing `updateCommissionAction` (PATCH) for each with the updated keyword string. Shows progress indicator (`3/7 updated…`). On completion, updates `commissionSearchRows` in local state so the preview list reflects the change without a full bootstrap re-fetch.
- **Error handling**: If any individual update fails, stop and show which commission failed. Already-applied changes are persisted (not rolled back — the operation is not atomic, but keyword edits are low-risk and easily re-run).
- **Data source**: Operates on `commissionSearchRows` from bootstrap data (already in memory), so no additional API call needed for matching.

## Visual Specifications

### Thumbnail Card

- Border: `border border-gray-200 dark:border-gray-700`
- Border radius: `rounded-lg`
- Image: `aspect-1280/525`, `object-contain`, same lazy-load as current
- Label area: file name in `text-xs font-medium`, link count in `text-xs text-gray-400`
- Selected state: `ring-2 ring-blue-500`, label background `bg-blue-50 dark:bg-blue-950/30`
- Hover: subtle shadow lift

### Drawer

- Overlay: `bg-black/15 backdrop-blur-sm`
- Panel width: `max-w-lg` (desktop), full-width bottom sheet (mobile)
- Panel background: `bg-white dark:bg-gray-950`
- Panel border-radius: `rounded-l-2xl` (desktop), `rounded-t-2xl` (mobile/sheet)
- Header: file name `text-base font-semibold`, subtitle `text-sm text-gray-500`
- Close button: `size-8 rounded-lg bg-gray-100 dark:bg-gray-800`
- Body: scrollable, contains `CommissionEditForm` as-is

### Keyword Replace Popover

- Trigger: secondary button style matching `adminActionLinkStyles`
- Popover: `rounded-xl border shadow-lg`, max-width ~380px
- Match preview: compact rows with mini thumbnail, file name, strikethrough old → green new
- Replace all button: primary button style

## Migration Notes

- `CommissionEditForm` component is reused inside the drawer — no changes to the form itself
- `SortableCharacterCard` loses its inline form rendering, gains a `CommissionThumbnailGrid` child
- The `CommissionEditFormSkeleton` can be simplified to a grid skeleton
- Image version caching (sessionStorage) continues to work — the drawer mounts/unmounts, but version is read from storage on each mount
- Scroll position restoration (`AdminEditPage`) remains relevant for the main page scroll, not the drawer
