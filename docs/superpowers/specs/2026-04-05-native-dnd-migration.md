# Native HTML5 Drag-and-Drop Migration

> Replace `@dnd-kit` with native HTML5 drag-and-drop on both `/edit` (character reordering) and `/suggestion` (featured keyword reordering) pages. Reduces admin JS bundle by ~30-40KB minified while preserving identical reorder semantics.

## Problem

`@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities` contribute ~30-40KB minified to the admin bundle. Both drag-and-drop use sites are simple vertical list reorders — a low-frequency operation that doesn't justify a dedicated library. Native HTML5 drag-and-drop handles this with zero dependencies.

## Design Decision

**Native HTML5 drag-and-drop** was chosen because:

- The operation is rare (character order changes infrequently, keyword list has max 6 items)
- Both use sites are simple vertical list reorders — no complex collision detection, no multi-axis, no nested sortables
- The visual polish loss (no animated item displacement during drag) is acceptable for rare operations
- A horizontal drop indicator line provides clear enough feedback for placement
- Removes three npm packages from the dependency tree

## Scope

### In scope

1. Replace dnd-kit in `CommissionManager` / `useCommissionManager` / `SortableCharacterCard` / `SortableDivider` with native drag events
2. Replace dnd-kit in `AdminSuggestionDashboard` / `SortableKeywordItem` with native drag events
3. Add a drop indicator (horizontal line) that appears between items during `dragover`
4. Remove `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` from `apps/admin/package.json`

### Out of scope

- Changes to the character card visual design, commission thumbnail grid, or drawer
- Changes to the active/archived divider business logic (status boundary, `saveCharacterOrder` payload)
- Changes to the suggestion page save flow
- Keyboard-based reordering (dnd-kit's `KeyboardSensor` is dropped; the drag handle remains mouse/touch only)

## Architecture

### Shared Utility: `useNativeDragReorder`

A small custom hook encapsulating native drag-and-drop state for vertical list reordering. Used by both pages.

```ts
interface UseNativeDragReorderOptions<T> {
  items: T[]
  getItemId: (item: T) => string | number
  onReorder: (fromIndex: number, toIndex: number) => void
  disabled?: boolean
}

interface UseNativeDragReorderResult {
  dragHandleProps: (index: number) => {
    draggable: true
    onDragStart: (e: DragEvent) => void
    onDragEnd: () => void
  }
  containerProps: {
    onDragOver: (e: DragEvent) => void
    onDragLeave: () => void
    onDrop: (e: DragEvent) => void
  }
  dropIndicatorIndex: number | null // render indicator before this index
  draggingIndex: number | null
}
```

- `dragHandleProps(index)` — spread onto the drag handle element at each index
- `containerProps` — spread onto the list container
- `dropIndicatorIndex` — when non-null, render a `<DropIndicator />` before the item at this index
- `draggingIndex` — index of the currently dragged item (for opacity/style)

The hook tracks `dragStartIndex` and computes `dropIndicatorIndex` from `dragover` events by measuring cursor Y against item bounding rects. It uses `e.dataTransfer.effectAllowed = 'move'` and `e.preventDefault()` in `dragover` to permit drops.

### Drop Indicator Component

A thin, full-width horizontal line rendered between list items when `dropIndicatorIndex` is non-null.

```
Visual: ──────●────────────────────●──────
        2px solid blue-500, small circles at ends
```

- Absolutely positioned or inserted as a sibling element at the indicator index
- Approach: render as a conditional element in the list. When `dropIndicatorIndex === i`, insert `<DropIndicator />` before item `i`.
- Height: 2px, color: `bg-blue-500 dark:bg-blue-400`
- End dots: `size-1.5 rounded-full bg-blue-500` absolutely positioned at left/right edges
- Transitions: fade in with `animate-[fadeIn_100ms_ease-out]`

### `/edit` Page Changes

#### `useCommissionManager.ts`

- Remove: `useSensors`, `useSensor`, `PointerSensor`, `KeyboardSensor`, `sortableKeyboardCoordinates` imports from `@dnd-kit/core` / `@dnd-kit/sortable`
- Remove: `arrayMove as dndArrayMove` import from `@dnd-kit/sortable`
- Remove: `sensors` setup (lines 413-418)
- Remove: `handleDragOver` callback (lines 420-441) — native drag doesn't need intermediate reordering
- Replace: `handleDragEnd` — now receives `(fromIndex, toIndex)` from the native drag hook, performs the array move + `persistOrder()` in one step
- Add: plain `arrayMove` utility (inline or extracted) — splice-based, ~3 lines
- Remove from return: `sensors`, `handleDragOver`, `itemIds` (no longer needed by `SortableContext`)
- Add to return: the reorder handler that takes `(fromIndex, toIndex)`

#### `CommissionManager.tsx`

- Remove: `DndContext`, `closestCenter` imports from `@dnd-kit/core`
- Remove: `SortableContext`, `verticalListSortingStrategy` imports from `@dnd-kit/sortable`
- Remove: `<DndContext>` / `<SortableContext>` wrapper (lines 444-497)
- Add: `useNativeDragReorder` hook, passing the `list` array and the reorder handler
- Pass `dragHandleProps` and `draggingIndex` down to character cards
- Spread `containerProps` on the list container div
- Render `<DropIndicator />` at `dropIndicatorIndex` position in the list map

#### `SortableCharacterCard.tsx`

- Remove: `useSortable` import from `@dnd-kit/sortable`
- Remove: `CSS` import from `@dnd-kit/utilities`
- Remove: the `useSortable` hook call and its destructured `{ attributes, listeners, setNodeRef, transform, transition, isDragging }`
- Props change: remove `item` (only used for `useSortable` id). Add `dragHandleProps` and `isDragging` as explicit props
- The drag handle button receives `{...dragHandleProps}` instead of `{...attributes} {...listeners}`
- The card root `div` no longer needs `ref={setNodeRef}` or `style={{ transform, transition }}`
- Opacity when dragging: `isDragging ? 'opacity-55' : ''` via className instead of inline style

#### `SortableDivider.tsx`

- Remove: `useSortable` and `CSS` imports
- Remove: the `useSortable` hook call — the divider is no longer a sortable item
- The divider becomes a plain `div` with no drag behavior
- It participates in the drop target zone: when a card is dragged over the divider's vertical position, the drop indicator appears above or below it, and the reorder handler places the card accordingly (crossing the divider changes active/archived status)
- Props: keep `activeCount`, remove `disabled` and `dividerId`

### `/suggestion` Page Changes

#### `AdminSuggestionDashboard.tsx`

- Remove: all `@dnd-kit/*` imports (`DndContext`, `closestCenter`, `KeyboardSensor`, `PointerSensor`, `useSensor`, `useSensors`, `SortableContext`, `sortableKeyboardCoordinates`, `arrayMove`, `verticalListSortingStrategy`)
- Remove: `CSS` import from `@dnd-kit/utilities`
- Remove: `sensors` setup (lines 141-146)
- Remove: `<DndContext>` / `<SortableContext>` wrapper (lines 231-264)
- Add: `useNativeDragReorder` hook for the `selectedKeywords` array
- `handleDragEnd` replaced by `onReorder` callback that does `arrayMove` on `selectedKeywords`

#### `SortableKeywordItem` (inline component)

- Remove: `useSortable` hook and `CSS` import
- Remove: inline `style` with `transform`/`transition`
- Add: receive `dragHandleProps` and `isDragging` as props
- The grip button receives `{...dragHandleProps}` instead of `{...attributes} {...listeners}`

### Dependency Removal

Remove from `apps/admin/package.json`:

- `@dnd-kit/core`
- `@dnd-kit/sortable`
- `@dnd-kit/utilities`

Run `pnpm install` to clean lockfile.

## Drop Target Calculation

The `dragover` handler determines `dropIndicatorIndex` by:

1. Getting all item elements in the list container (via `querySelectorAll('[data-drag-item]')`)
2. For each item, computing the vertical midpoint from `getBoundingClientRect()`
3. Finding the first item whose midpoint is below the cursor Y — the indicator goes before that item
4. If cursor is below all items, indicator goes after the last item (index = items.length)
5. Skip the dragged item itself when computing the target index

This is the standard approach for native DnD vertical lists and avoids needing dnd-kit's collision detection algorithms.

## Divider Interaction

The active/archived divider is treated as a regular item in the list for drop target calculation purposes:

- If a card is dropped above the divider, it becomes active
- If a card is dropped below the divider, it becomes archived
- The divider itself is not draggable — its position in the list is fixed relative to active/archived sections
- The `persistOrder` function already derives status from position relative to the divider — this logic is unchanged

## Migration Notes

- No API changes — `saveCharacterOrder` and `saveHomeFeaturedKeywordsAction` payloads are unchanged
- The ghost image during drag uses the browser's default drag ghost (semi-transparent snapshot of the dragged element). This is less polished than dnd-kit's overlay but acceptable for rare operations.
- Touch devices: HTML5 drag-and-drop has limited mobile support. Since the admin is primarily desktop-used, this is acceptable. The drag handle still shows the grip icon but won't function on touch-only devices without a polyfill. If needed later, a lightweight touch polyfill (~2KB) can be added.
- Keyboard reordering is dropped. If needed later, up/down arrow buttons can be added independently of the drag system.
