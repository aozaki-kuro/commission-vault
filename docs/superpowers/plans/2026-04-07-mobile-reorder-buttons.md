# Mobile Character Reorder Buttons — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make character reordering usable on mobile by adding up/down arrow buttons, since HTML5 drag-and-drop doesn't work on touch devices.

**Architecture:** Add a mobile-only `isReorderMode` toggle to `CommissionManager`. In reorder mode, `SortableCharacterCard` renders up/down arrows instead of the drag handle. On desktop, existing drag behavior is untouched. Reorder actions call the existing `handleReorder` which feeds into the order save queue.

**Tech Stack:** React 19, Tailwind CSS (responsive `sm:` prefix), `@tabler/icons-react`

---

### Task 1: Hide drag handle on mobile

Hide the grip icon below `sm` breakpoint so mobile users don't see a non-functional handle.

**Files:**

- Modify: `apps/admin/src/components/edit/SortableCharacterCard.tsx:97-123`

- [ ] **Step 1: Add `hidden sm:inline-flex` to drag handle button**

In `SortableCharacterCard.tsx`, the drag handle button currently has `inline-flex`. Change it to be hidden on mobile, visible on desktop:

```tsx
<button
  type="button"
  {...dragHandleProps}
  disabled={isDeleting || disableDrag}
  onClick={event => event.stopPropagation()}
  aria-label={
    disableDrag
      ? `Drag disabled while search is applied for ${character.name}`
      : `Drag ${character.name}`
  }
  className={`
    hidden sm:inline-flex size-8 shrink-0 items-center justify-center rounded-lg
    border border-transparent text-gray-400 transition
    focus-visible:ring-2 focus-visible:ring-gray-400
    focus-visible:ring-offset-2 focus-visible:ring-offset-white
    focus-visible:outline-none
    dark:focus-visible:ring-offset-gray-900
    ${
      disableDrag || isDeleting
        ? 'cursor-not-allowed opacity-50'
        : `
        cursor-grab
        hover:text-gray-600
        active:cursor-grabbing
        dark:hover:text-gray-200
      `
    }
  `}
>
  <IconGripHorizontal className="size-5" stroke={2} aria-hidden="true" />
</button>
```

The only change is `inline-flex` → `hidden sm:inline-flex`.

- [ ] **Step 2: Verify visually**

Run `bun run dev:admin`, open the edit page, resize browser to mobile width (< 640px). Confirm the grip icon disappears. At ≥ 640px it should still show and drag should still work.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/components/edit/SortableCharacterCard.tsx
git commit -m "fix(admin): hide non-functional drag handle on mobile"
```

---

### Task 2: Add reorder mode state and toggle button

Add a mobile-only "Reorder" toggle button to `CommissionManager` that controls `isReorderMode`.

**Files:**

- Modify: `apps/admin/src/components/edit/CommissionManager.tsx`

- [ ] **Step 1: Add icon import and state**

Add `IconArrowsSort` to the import from `@tabler/icons-react` (line 14), and add state after the existing `searchQuery` state (around line 61):

```tsx
import { IconArrowsSort, IconSearch, IconX } from '@tabler/icons-react'
```

```tsx
const [isReorderMode, setIsReorderMode] = useState(false)
```

- [ ] **Step 2: Reset reorder mode when search is applied**

Add logic to `handleSearchChange` to exit reorder mode when a search query is entered:

```tsx
const handleSearchChange = (value: string) => {
  setSearchQuery(value)
  if (!normalizeAdminSearchQuery(value)) {
    closeAllCharacterOpen()
  }
  if (normalizeAdminSearchQuery(value)) {
    setIsReorderMode(false)
  }
}
```

- [ ] **Step 3: Add Reorder toggle button next to search bar**

Inside the `<div className="flex gap-2">` that wraps the search input and `KeywordReplacePopover`, add a mobile-only reorder toggle button between them:

```tsx
<div className="flex gap-2">
  <div className="relative flex-1">{/* ... existing search input ... */}</div>
  <button
    type="button"
    onClick={() => setIsReorderMode(prev => !prev)}
    aria-pressed={isReorderMode}
    aria-label={isReorderMode ? 'Exit reorder mode' : 'Enter reorder mode'}
    className={`
      inline-flex sm:hidden size-10 shrink-0 items-center justify-center
      rounded-xl border text-sm font-medium transition
      focus-visible:ring-2 focus-visible:ring-gray-400
      focus-visible:ring-offset-2 focus-visible:ring-offset-white
      focus-visible:outline-none
      dark:focus-visible:ring-offset-gray-900
      ${
        isReorderMode
          ? `
          border-blue-200 bg-blue-50 text-blue-600
          dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400
        `
          : `
          border-gray-200 bg-white text-gray-500
          hover:bg-gray-50 hover:text-gray-700
          dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400
          dark:hover:bg-gray-800 dark:hover:text-gray-200
        `
      }
      ${hasAppliedSearchQuery ? 'pointer-events-none opacity-50' : ''}
    `}
  >
    <IconArrowsSort className="size-4.5" stroke={2} aria-hidden="true" />
  </button>
  <KeywordReplacePopover
    commissionSearchRows={commissionSearchRows}
    onComplete={handleKeywordReplaceComplete}
  />
</div>
```

Key points:

- `sm:hidden` — only visible on mobile
- `aria-pressed` — toggle semantics
- Blue tint when active, neutral when inactive
- Disabled appearance when search is applied

- [ ] **Step 4: Pass `isReorderMode` and move handlers to SortableCharacterCard**

Add two new props to the `SortableCharacterCard` render inside the `list.map()`:

```tsx
<SortableCharacterCard
  {/* ... all existing props ... */}
  isReorderMode={isReorderMode}
  onMoveUp={index > 0 && (dividerIndex === -1 || index !== dividerIndex + 1 || index > 0)
    ? () => handleReorder(index, index - 1)
    : undefined}
  onMoveDown={index < list.length - 1 && (dividerIndex === -1 || index + 1 !== dividerIndex || index < list.length - 1)
    ? () => handleReorder(index, index + 1)
    : undefined}
/>
```

Wait — the index math needs to account for the divider. Simpler approach: pass the raw handlers and let the parent compute:

```tsx
isReorderMode={isReorderMode}
onMoveUp={index === 0 ? undefined : () => {
  // Skip over divider when moving up
  const targetIndex = dividerIndex !== -1 && index - 1 === dividerIndex
    ? index - 2
    : index - 1
  if (targetIndex >= 0) handleReorder(index, targetIndex)
}}
onMoveDown={index === list.length - 1 ? undefined : () => {
  // Skip over divider when moving down
  const targetIndex = dividerIndex !== -1 && index + 1 === dividerIndex
    ? index + 2
    : index + 1
  if (targetIndex < list.length) handleReorder(index, targetIndex)
}}
```

Note: Moving past the divider changes active/archived status — this is the desired behavior per the spec. The divider is a list item, so skipping its index when computing the target means the character swaps across the boundary. This matches the existing drag behavior where dropping past the divider changes status.

- [ ] **Step 5: Verify toggle button appears on mobile only**

Run `bun run dev:admin`, check:

- Mobile (< 640px): Reorder button visible next to search
- Desktop (≥ 640px): Reorder button hidden
- Button toggles blue active state on click
- Applying a search query disables and dims the button

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/components/edit/CommissionManager.tsx
git commit -m "feat(admin): add mobile-only reorder mode toggle button"
```

---

### Task 3: Render up/down arrows in SortableCharacterCard

When `isReorderMode` is true, show up/down arrow buttons in the drag handle slot (mobile only).

**Files:**

- Modify: `apps/admin/src/components/edit/SortableCharacterCard.tsx`

- [ ] **Step 1: Add imports and props**

Add arrow icons to the import:

```tsx
import {
  IconArrowDown,
  IconArrowUp,
  IconDeviceFloppy,
  IconGripHorizontal,
  IconPencil,
  IconTrash,
  IconX,
} from '@tabler/icons-react'
```

Add new props to `SortableCharacterCardProps`:

```tsx
interface SortableCharacterCardProps {
  // ... existing props ...
  isReorderMode?: boolean
  onMoveUp?: () => void
  onMoveDown?: () => void
}
```

Add to destructuring:

```tsx
export function SortableCharacterCard({
  // ... existing props ...
  isReorderMode = false,
  onMoveUp,
  onMoveDown,
}: SortableCharacterCardProps) {
```

- [ ] **Step 2: Add reorder arrows markup before the drag handle button**

Insert mobile-only reorder arrows right before the existing drag handle button (which is already `hidden sm:inline-flex` from Task 1):

```tsx
{/* 移动端排序箭头 — 仅在 reorder 模式下显示 */}
{isReorderMode && (
  <div className="flex shrink-0 flex-col gap-0.5 sm:hidden">
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onMoveUp?.()
      }}
      disabled={!onMoveUp}
      aria-label={`Move ${character.name} up`}
      className={`
        inline-flex size-6 items-center justify-center rounded-md
        border border-transparent text-gray-400 transition
        focus-visible:ring-2 focus-visible:ring-gray-400
        focus-visible:outline-none
        ${onMoveUp
          ? `
            hover:text-gray-600 active:bg-gray-100
            dark:hover:text-gray-200 dark:active:bg-gray-800
          `
          : 'cursor-not-allowed opacity-30'}
      `}
    >
      <IconArrowUp className="size-3.5" stroke={2.5} aria-hidden="true" />
    </button>
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onMoveDown?.()
      }}
      disabled={!onMoveDown}
      aria-label={`Move ${character.name} down`}
      className={`
        inline-flex size-6 items-center justify-center rounded-md
        border border-transparent text-gray-400 transition
        focus-visible:ring-2 focus-visible:ring-gray-400
        focus-visible:outline-none
        ${onMoveDown
          ? `
            hover:text-gray-600 active:bg-gray-100
            dark:hover:text-gray-200 dark:active:bg-gray-800
          `
          : 'cursor-not-allowed opacity-30'}
      `}
    >
      <IconArrowDown className="size-3.5" stroke={2.5} aria-hidden="true" />
    </button>
  </div>
)}

{/* 桌面端拖拽手柄 — 移动端始终隐藏 */}
<button
  type="button"
  {...dragHandleProps}
  {/* ... existing drag handle (already hidden sm:inline-flex from Task 1) ... */}
>
```

Key design decisions:

- `sm:hidden` — arrows only on mobile
- Vertical stack (`flex-col`) keeps them compact in the card header
- `size-6` buttons with `size-3.5` icons — small enough to fit, big enough to tap
- Disabled state (`opacity-30` + `cursor-not-allowed`) for first/last items
- `event.stopPropagation()` prevents card toggle on arrow click

- [ ] **Step 3: Update subtitle text for mobile context**

In `CommissionManager.tsx`, update the subtitle to mention the reorder button on mobile:

```tsx
<p
  className="
  text-sm text-gray-600
  dark:text-gray-300
"
>
  <span className="hidden sm:inline">
    Drag to reprioritize characters and edit their commissions in place.{' '}
  </span>
  <span className="sm:hidden">Tap the sort button to reorder characters. </span>
  Click to expand.
</p>
```

- [ ] **Step 4: Verify full flow on mobile**

Run `bun run dev:admin`, resize to mobile:

1. Default: no drag handle, no arrows visible
2. Tap "Reorder" button → arrows appear on each card
3. First card has no up arrow, last card has no down arrow
4. Tap down arrow on a card → card moves down, order saves
5. Move a card past the active/stale divider → status changes
6. Tap "Reorder" again → arrows disappear
7. Apply search → reorder button disabled

- [ ] **Step 5: Verify desktop is unaffected**

Resize to desktop (≥ 640px):

1. Reorder button hidden
2. Drag handles visible and functional
3. Drag-and-drop works as before

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/components/edit/SortableCharacterCard.tsx apps/admin/src/components/edit/CommissionManager.tsx
git commit -m "feat(admin): add mobile reorder arrows for character cards"
```

---

### Task 4: Typecheck and lint

**Files:**

- All modified files

- [ ] **Step 1: Run typecheck**

```bash
bun run typecheck
```

Expected: no errors.

- [ ] **Step 2: Run lint**

```bash
bun run lint
```

Expected: no errors (or only pre-existing ones).

- [ ] **Step 3: Fix any issues and commit**

If typecheck or lint surfaces issues, fix them and commit:

```bash
git add -u
git commit -m "fix(admin): resolve lint/type issues in mobile reorder"
```
