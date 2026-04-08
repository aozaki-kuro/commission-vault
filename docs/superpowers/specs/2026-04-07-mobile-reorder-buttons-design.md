# Mobile Character Reorder Buttons

**Date:** 2026-04-07
**Status:** Draft

## Problem

The admin edit page uses HTML5 native drag-and-drop API (`draggable` + `onDragStart/onDragOver/onDrop`) for character reordering. Mobile browsers do not fire drag events from touch interactions, making the arrange function unusable on phones/tablets.

## Solution

Add a mobile-only reorder mode with up/down arrow buttons. Desktop drag behavior remains untouched.

## Design

### Breakpoint

- **Mobile (< sm / 640px):** New behavior
- **Desktop (≥ sm / 640px):** No changes

### Default State (Mobile)

- Drag handle (`IconGripHorizontal`) is **hidden** — it doesn't work on touch devices and showing it is misleading
- Card header renders: status dot, name, count, edit/delete buttons (no handle slot)

### Reorder Mode (Mobile)

- A **"Reorder" toggle button** appears at the top of the character list (near search bar area), visible only on mobile
- When activated:
  - Each character card shows **up/down arrow buttons** in the drag handle slot (`IconArrowUp` / `IconArrowDown`)
  - First item hides up arrow; last item hides down arrow
  - Clicking an arrow immediately calls `arrayMove` + existing `handleReorder`, which triggers the order save queue
  - Stale divider participates: moving a character past the divider changes its active/archived status (same as drag behavior)
  - Card expand/collapse, inline rename, and delete remain functional
- Clicking "Reorder" again exits the mode

### State Management

- `CommissionManager.tsx` gains a `isReorderMode: boolean` state
- Passed to `SortableCharacterCard` to decide between rendering arrows vs. nothing (mobile) or drag handle (desktop)
- Reorder mode is disabled/reset when search query is applied (same as drag disable logic)

### What Does NOT Change

- `useNativeDragReorder.ts` hook — untouched
- Desktop drag handle and drag behavior — untouched
- Order save queue (`createLatestCharacterOrderSaveQueue`) — reused as-is
- `DropIndicator.tsx` — not used in button mode
- `SortableDivider.tsx` — position logic reused, no visual change needed

### Files to Modify

| File                               | Change                                                                                                           |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `CommissionManager.tsx`            | Add `isReorderMode` state, Reorder toggle button (mobile only), pass mode to cards, wire up arrow click handlers |
| `SortableCharacterCard.tsx`        | Accept reorder mode prop; conditionally render arrows vs. drag handle vs. nothing based on mode + breakpoint     |
| (possibly) new `ReorderArrows.tsx` | Small component for up/down arrow buttons if extraction keeps card component clean                               |

### Icons

Use `@tabler/icons-react`: `IconArrowUp`, `IconArrowDown` (already available in the dependency).

### Accessibility

- Reorder button: `aria-pressed` reflects toggle state
- Arrow buttons: `aria-label="Move {name} up"` / `"Move {name} down"`
- Disabled arrows (first/last): `aria-disabled="true"`
