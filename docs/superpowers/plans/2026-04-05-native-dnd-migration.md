# Native HTML5 Drag-and-Drop Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `@dnd-kit` with native HTML5 drag-and-drop on both `/edit` and `/suggestion` pages, removing ~30-40KB from the admin bundle.

**Architecture:** A shared `useNativeDragReorder` hook encapsulates all native drag state and drop target calculation. A `DropIndicator` component renders the visual line. Both pages consume the hook identically — pass items, get back props to spread.

**Tech Stack:** React 19, native HTML5 Drag and Drop API, Tailwind CSS 4.

**Spec:** `docs/superpowers/specs/2026-04-05-native-dnd-migration.md`

---

### File Map

| Action | Path                                                       | Responsibility                                                             |
| ------ | ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| Create | `apps/admin/src/hooks/useNativeDragReorder.ts`             | Shared hook: drag state, drop target calculation, reorder callback         |
| Create | `apps/admin/src/components/DropIndicator.tsx`              | Visual drop indicator line between items                                   |
| Modify | `apps/admin/src/hooks/useCommissionManager.ts`             | Remove dnd-kit imports/sensors/handlers, add `arrayMove` + `handleReorder` |
| Modify | `apps/admin/src/components/edit/CommissionManager.tsx`     | Replace `DndContext`/`SortableContext` with `useNativeDragReorder`         |
| Modify | `apps/admin/src/components/edit/SortableCharacterCard.tsx` | Remove `useSortable`, receive `dragHandleProps`/`isDragging` as props      |
| Modify | `apps/admin/src/components/edit/SortableDivider.tsx`       | Remove `useSortable`, become plain div                                     |
| Modify | `apps/admin/src/components/AdminSuggestionDashboard.tsx`   | Replace dnd-kit with `useNativeDragReorder`                                |
| Modify | `apps/admin/package.json`                                  | Remove `@dnd-kit/*` packages                                               |

---

### Task 1: Create `useNativeDragReorder` Hook

**Files:**

- Create: `apps/admin/src/hooks/useNativeDragReorder.ts`

- [ ] **Step 1: Create the hook file**

```ts
// apps/admin/src/hooks/useNativeDragReorder.ts
import type { DragEvent } from 'react'
import { useCallback, useRef, useState } from 'react'

interface UseNativeDragReorderOptions {
  itemCount: number
  onReorder: (fromIndex: number, toIndex: number) => void
  disabled?: boolean
}

const DRAG_ITEM_ATTR = 'data-drag-item-index'

export function useNativeDragReorder({
  itemCount,
  onReorder,
  disabled = false,
}: UseNativeDragReorderOptions) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [dropIndicatorIndex, setDropIndicatorIndex] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const computeDropIndex = useCallback(
    (clientY: number, currentDraggingIndex: number): number | null => {
      const container = containerRef.current
      if (!container) return null

      const items = container.querySelectorAll<HTMLElement>(`[${DRAG_ITEM_ATTR}]`)
      if (items.length === 0) return null

      for (const item of items) {
        const index = Number(item.getAttribute(DRAG_ITEM_ATTR))
        if (index === currentDraggingIndex) continue

        const rect = item.getBoundingClientRect()
        const midpoint = rect.top + rect.height / 2

        if (clientY < midpoint) {
          return index
        }
      }

      // Below all items — drop at the end
      return itemCount
    },
    [itemCount],
  )

  const dragHandleProps = useCallback(
    (index: number) => {
      if (disabled) {
        return {
          'aria-disabled': true as const,
          draggable: false as const,
        }
      }

      return {
        draggable: true as const,
        onDragStart: (e: DragEvent) => {
          e.dataTransfer.effectAllowed = 'move'
          // Set minimal data so the drag is recognized
          e.dataTransfer.setData('text/plain', String(index))
          setDraggingIndex(index)
        },
        onDragEnd: () => {
          setDraggingIndex(null)
          setDropIndicatorIndex(null)
        },
      }
    },
    [disabled],
  )

  const containerProps = {
    ref: containerRef,
    onDragOver: (e: DragEvent) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'

      if (draggingIndex === null) return
      const targetIndex = computeDropIndex(e.clientY, draggingIndex)
      setDropIndicatorIndex(targetIndex)
    },
    onDragLeave: (e: DragEvent) => {
      // Only clear if leaving the container itself, not entering a child
      if (containerRef.current && !containerRef.current.contains(e.relatedTarget as Node)) {
        setDropIndicatorIndex(null)
      }
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault()

      if (draggingIndex === null || dropIndicatorIndex === null) {
        setDraggingIndex(null)
        setDropIndicatorIndex(null)
        return
      }

      // Convert dropIndicatorIndex (visual position) to actual move target
      let toIndex = dropIndicatorIndex
      // If dropping below the original position, adjust because the dragged
      // item will be removed first, shifting indices down
      if (toIndex > draggingIndex) {
        toIndex -= 1
      }

      if (toIndex !== draggingIndex) {
        onReorder(draggingIndex, toIndex)
      }

      setDraggingIndex(null)
      setDropIndicatorIndex(null)
    },
  }

  return {
    containerProps,
    dragHandleProps,
    dragItemAttr: (index: number) => ({ [DRAG_ITEM_ATTR]: index }),
    draggingIndex,
    dropIndicatorIndex,
  }
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/aozaki/GitHub/commission-index && bun run --cwd apps/admin tsc --noEmit 2>&1 | head -20
```

Expected: No errors related to useNativeDragReorder.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/hooks/useNativeDragReorder.ts
git commit -m "feat(admin): add useNativeDragReorder hook for native HTML5 drag-and-drop"
```

---

### Task 2: Create `DropIndicator` Component

**Files:**

- Create: `apps/admin/src/components/DropIndicator.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/admin/src/components/DropIndicator.tsx

export function DropIndicator() {
  return (
    <div
      aria-hidden="true"
      className="
        pointer-events-none relative flex h-0.5 items-center
      "
    >
      <div
        className="
        size-1.5 shrink-0 rounded-full bg-blue-500
        dark:bg-blue-400
      "
      />
      <div
        className="
        h-0.5 flex-1 bg-blue-500
        dark:bg-blue-400
      "
      />
      <div
        className="
        size-1.5 shrink-0 rounded-full bg-blue-500
        dark:bg-blue-400
      "
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/aozaki/GitHub/commission-index && bun run --cwd apps/admin tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/components/DropIndicator.tsx
git commit -m "feat(admin): add DropIndicator component"
```

---

### Task 3: Refactor `useCommissionManager` — Remove dnd-kit

**Files:**

- Modify: `apps/admin/src/hooks/useCommissionManager.ts`

- [ ] **Step 1: Remove dnd-kit imports and add `arrayMove` utility**

Remove these imports:

```ts
import type { DragOverEvent } from '@dnd-kit/core'
import { KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove as dndArrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
```

Add a plain `arrayMove` function near the top of the file (after the type definitions, before the hook):

```ts
function arrayMove<T>(array: T[], fromIndex: number, toIndex: number): T[] {
  const next = [...array]
  const [removed] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, removed)
  return next
}
```

- [ ] **Step 2: Remove `sensors` setup**

Delete the `sensors` block (lines 413-418):

```ts
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  }),
)
```

- [ ] **Step 3: Replace `handleDragOver` and `handleDragEnd` with `handleReorder`**

Delete `handleDragOver` (lines 420-441) and `handleDragEnd` (lines 443-445).

Add `handleReorder`:

```ts
const handleReorder = useCallback(
  (fromIndex: number, toIndex: number) => {
    const nextList = arrayMove(list, fromIndex, toIndex)
    dispatchList({ type: 'set', value: nextList })
    persistOrder(nextList)
  },
  [list, persistOrder],
)
```

- [ ] **Step 4: Update the return object**

Remove from return: `sensors`, `handleDragOver`, `handleDragEnd`, `itemIds`.

Add to return: `handleReorder`.

The return block should include:

```ts
return {
  activeCount,
  cancelEditing,
  closeAllCharacterOpen,
  confirmingCharacter,
  deletingId,
  editing,
  feedback,
  handleDeleteCommission,
  handleReorder,
  handleRenameChange,
  handleRequestDelete,
  isDeletePending,
  list,
  openIds,
  orderedCharacters,
  performDeleteCharacter,
  startEditingName,
  submitRename,
  toggleCharacterOpen,
  commissionMap,
  closeConfirmDialog: () => setConfirmingCharacter(null),
}
```

- [ ] **Step 5: Verify it compiles (expect errors in consumers)**

```bash
cd /Users/aozaki/GitHub/commission-index && bun run --cwd apps/admin tsc --noEmit 2>&1 | head -30
```

Expected: Type errors in `CommissionManager.tsx` referencing removed properties (`sensors`, `handleDragOver`, `handleDragEnd`, `itemIds`). This is expected — they'll be fixed in Task 4.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/hooks/useCommissionManager.ts
git commit -m "refactor(admin): remove dnd-kit from useCommissionManager, add handleReorder"
```

---

### Task 4: Refactor `CommissionManager` — Use Native Drag

**Files:**

- Modify: `apps/admin/src/components/edit/CommissionManager.tsx`

- [ ] **Step 1: Update imports**

Remove these imports:

```ts
import { closestCenter, DndContext } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
```

Add these imports:

```ts
import { DropIndicator } from '../DropIndicator'
import { useNativeDragReorder } from '../../hooks/useNativeDragReorder'
```

- [ ] **Step 2: Update destructured values from `useCommissionManager`**

Change the destructuring (around line 66) — remove `handleDragEnd`, `handleDragOver`, `itemIds`, `sensors` and add `handleReorder`:

```ts
const {
  activeCount,
  cancelEditing,
  closeAllCharacterOpen,
  closeConfirmDialog,
  commissionMap,
  confirmingCharacter,
  deletingId,
  editing,
  feedback,
  handleDeleteCommission,
  handleReorder,
  handleRenameChange,
  handleRequestDelete,
  isDeletePending,
  list,
  openIds,
  orderedCharacters,
  performDeleteCharacter,
  startEditingName,
  submitRename,
  toggleCharacterOpen,
} = useCommissionManager({
  characters,
  commissions: loadedCommissions,
})
```

- [ ] **Step 3: Add the native drag hook**

After the `dividerIndex` calculation (around line 184), add:

```ts
const {
  containerProps: dragContainerProps,
  dragHandleProps,
  dragItemAttr,
  draggingIndex,
  dropIndicatorIndex,
} = useNativeDragReorder({
  itemCount: list.length,
  onReorder: handleReorder,
  disabled: hasAppliedSearchQuery,
})
```

- [ ] **Step 4: Replace `DndContext`/`SortableContext` with native drag container**

Replace the entire block (lines 443-498):

```tsx
<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragOver={handleDragOver}
  onDragEnd={handleDragEnd}
>
  <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
    {list.map((item, index) => {
      ...
    })}
  </SortableContext>
</DndContext>
```

With:

```tsx
<div {...dragContainerProps}>
  {list.map((item, index) => {
    if (item.type === 'divider') {
      return (
        <div key="divider" {...dragItemAttr(index)}>
          {dropIndicatorIndex === index && <DropIndicator />}
          <SortableDivider activeCount={activeCount} />
        </div>
      )
    }

    const character = item.data
    const visibleCharacterCommissions = visibleCommissionsByCharacter.get(character.id) ?? []
    const isActive = dividerIndex === -1 ? true : index < dividerIndex
    const shouldAutoOpen = hasAppliedSearchQuery && autoLoadSearchCharacterIds.has(character.id)

    return (
      <div key={character.id} {...dragItemAttr(index)}>
        {dropIndicatorIndex === index && <DropIndicator />}
        <SortableCharacterCard
          character={character}
          isActive={isActive}
          totalCommissions={character.commissionCount}
          commissionList={visibleCharacterCommissions}
          isCommissionsLoaded={loadedCharacterIds.has(character.id)}
          isCommissionsLoading={loadingCharacterIds.has(character.id)}
          isOpen={shouldAutoOpen || openIds.has(character.id)}
          onToggle={() => handleToggle(character.id)}
          selectedCommissionId={selectedCommission?.id ?? null}
          onSelectCommission={handleSelectCommission}
          buttonRefFor={buttonRefFor}
          isEditing={editing?.id === character.id}
          editingValue={editing?.id === character.id ? editing.value : character.name}
          onStartEdit={() => startEditingName(character)}
          onRenameChange={handleRenameChange}
          onCancelEdit={cancelEditing}
          onSubmitRename={submitRename}
          onRequestDelete={() => handleRequestDelete(character)}
          isDeleting={deletingId === character.id || isDeletePending}
          isDragging={draggingIndex === index}
          dragHandleProps={dragHandleProps(index)}
          disableDrag={hasAppliedSearchQuery}
          reduceMotion={hasAppliedSearchQuery}
        />
      </div>
    )
  })}
  {dropIndicatorIndex === list.length && <DropIndicator />}
</div>
```

- [ ] **Step 5: Verify it compiles (expect errors in SortableCharacterCard props)**

```bash
cd /Users/aozaki/GitHub/commission-index && bun run --cwd apps/admin tsc --noEmit 2>&1 | head -30
```

Expected: Type errors for `SortableCharacterCard` props (`character` instead of `item`, new `isDragging`/`dragHandleProps` props, removed `item` prop). Fixed in Task 5.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/components/edit/CommissionManager.tsx
git commit -m "refactor(admin): replace DndContext with native drag in CommissionManager"
```

---

### Task 5: Refactor `SortableCharacterCard` — Remove `useSortable`

**Files:**

- Modify: `apps/admin/src/components/edit/SortableCharacterCard.tsx`

- [ ] **Step 1: Remove dnd-kit imports**

Remove:

```ts
import type { CharacterItem } from '../../hooks/useCommissionManager'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
```

- [ ] **Step 2: Update the props interface**

Replace the interface with:

```ts
interface SortableCharacterCardProps {
  buttonRefFor: (id: number) => (element: HTMLButtonElement | null) => void
  character: CharacterRow
  commissionList: CommissionRow[]
  disableDrag?: boolean
  dragHandleProps: Record<string, unknown>
  editingValue: string
  isActive: boolean
  isCommissionsLoaded: boolean
  isCommissionsLoading: boolean
  isDeleting: boolean
  isDragging: boolean
  isEditing: boolean
  isOpen: boolean
  onCancelEdit: () => void
  onRenameChange: (value: string) => void
  onRequestDelete: () => void
  onSelectCommission: (commission: CommissionRow) => void
  onStartEdit: () => void
  onSubmitRename: () => void
  onToggle: () => void
  reduceMotion?: boolean
  selectedCommissionId: number | null
  totalCommissions: number
}
```

Changes: `item: CharacterItem` → `character: CharacterRow`, added `dragHandleProps: Record<string, unknown>` and `isDragging: boolean`.

- [ ] **Step 3: Update the component function signature and body**

Update the destructuring — replace `item` with `character`, add `dragHandleProps` and `isDragging`:

```ts
export function SortableCharacterCard({
  buttonRefFor,
  character,
  commissionList,
  disableDrag = false,
  dragHandleProps,
  editingValue,
  isActive,
  isCommissionsLoaded,
  isCommissionsLoading,
  isDeleting,
  isDragging,
  isEditing,
  isOpen,
  onCancelEdit,
  onRenameChange,
  onRequestDelete,
  onSelectCommission,
  onStartEdit,
  onSubmitRename,
  onToggle,
  reduceMotion = false,
  selectedCommissionId,
  totalCommissions,
}: SortableCharacterCardProps) {
```

Remove the line `const character = item.data` (it was deriving character from item).

Remove the `useSortable` hook call:

```ts
const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
  disabled: disableDrag || isDeleting,
  id: character.id,
})
```

- [ ] **Step 4: Update the root div — remove sortable refs and styles**

Replace:

```tsx
<div
  ref={setNodeRef}
  id={sectionId}
  data-character-section="true"
  data-character-status={isActive ? 'active' : 'archived'}
  data-total-commissions={totalCommissions}
  style={{
    opacity: isDragging ? 0.55 : 1,
    transform: CSS.Transform.toString(transform),
    transition,
  }}
>
```

With:

```tsx
<div
  id={sectionId}
  data-character-section="true"
  data-character-status={isActive ? 'active' : 'archived'}
  data-total-commissions={totalCommissions}
  className={isDragging ? 'opacity-55' : ''}
>
```

- [ ] **Step 5: Update the drag handle button — use native props**

Replace:

```tsx
<button
  type="button"
  {...attributes}
  {...listeners}
  disabled={isDeleting || disableDrag}
  onClick={event => event.stopPropagation()}
  aria-label={disableDrag
    ? `Drag disabled while search is applied for ${character.name}`
    : `Drag ${character.name}`}
  className={`...`}
>
```

With:

```tsx
<button
  type="button"
  {...dragHandleProps}
  disabled={isDeleting || disableDrag}
  onClick={event => event.stopPropagation()}
  aria-label={disableDrag
    ? `Drag disabled while search is applied for ${character.name}`
    : `Drag ${character.name}`}
  className={`
    inline-flex size-8 shrink-0 items-center justify-center rounded-lg
    border border-transparent text-gray-400 transition
    focus-visible:ring-2 focus-visible:ring-gray-400
    focus-visible:ring-offset-2 focus-visible:ring-offset-white
    focus-visible:outline-none
    dark:focus-visible:ring-offset-gray-900
    ${disableDrag || isDeleting
      ? 'cursor-not-allowed opacity-50'
      : `
        cursor-grab
        hover:text-gray-600
        active:cursor-grabbing
        dark:hover:text-gray-200
      `}
  `}
>
```

- [ ] **Step 6: Verify it compiles**

```bash
cd /Users/aozaki/GitHub/commission-index && bun run --cwd apps/admin tsc --noEmit 2>&1 | head -20
```

Expected: Clean — no type errors.

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/components/edit/SortableCharacterCard.tsx
git commit -m "refactor(admin): remove useSortable from SortableCharacterCard"
```

---

### Task 6: Simplify `SortableDivider` — Remove `useSortable`

**Files:**

- Modify: `apps/admin/src/components/edit/SortableDivider.tsx`

- [ ] **Step 1: Rewrite the component**

Replace the entire file contents with:

```tsx
interface SortableDividerProps {
  activeCount: number
}

export function SortableDivider({ activeCount }: SortableDividerProps) {
  return (
    <div className="relative flex items-center gap-3 py-4" data-stale-divider="true">
      <div
        className="
        flex-1 border-t-2 border-dashed border-gray-300
        dark:border-gray-600
      "
      />
      <span
        className="
        rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium
        text-gray-700 shadow-sm
        dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200
      "
      >
        Active ({activeCount}) / Stale
      </span>
      <div
        className="
        flex-1 border-t-2 border-dashed border-gray-300
        dark:border-gray-600
      "
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/aozaki/GitHub/commission-index && bun run --cwd apps/admin tsc --noEmit 2>&1 | head -20
```

Expected: Clean.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/components/edit/SortableDivider.tsx
git commit -m "refactor(admin): simplify SortableDivider to plain div"
```

---

### Task 7: Refactor `AdminSuggestionDashboard` — Use Native Drag

**Files:**

- Modify: `apps/admin/src/components/AdminSuggestionDashboard.tsx`

- [ ] **Step 1: Remove all dnd-kit imports**

Remove:

```ts
import type { DragEndEvent } from '@dnd-kit/core'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
```

Add:

```ts
import { DropIndicator } from './DropIndicator'
import { useNativeDragReorder } from '../hooks/useNativeDragReorder'
```

- [ ] **Step 2: Add inline `arrayMove` utility**

Add near the top of the file (after imports, before interfaces):

```ts
function arrayMove<T>(array: T[], fromIndex: number, toIndex: number): T[] {
  const next = [...array]
  const [removed] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, removed)
  return next
}
```

- [ ] **Step 3: Rewrite `SortableKeywordItem` to use native drag props**

Replace the entire `SortableKeywordItem` component with:

```tsx
interface KeywordItemProps {
  dragHandleProps: Record<string, unknown>
  isDragging: boolean
  keyword: string
  onRemove: (keyword: string) => void
}

function KeywordItem({ dragHandleProps, isDragging, keyword, onRemove }: KeywordItemProps) {
  return (
    <li
      className={`
        flex items-center gap-2 rounded-lg border border-gray-200 bg-white/80
        px-3 py-2
        dark:border-gray-700 dark:bg-gray-900/50
        ${isDragging ? 'opacity-55' : ''}
      `}
    >
      <button
        type="button"
        className="
          inline-flex size-7 shrink-0 items-center justify-center rounded-md
          border border-transparent text-gray-400 transition
          cursor-grab
          hover:text-gray-700
          active:cursor-grabbing
          dark:text-gray-500
          dark:hover:text-gray-200
        "
        aria-label={`Drag ${keyword}`}
        {...dragHandleProps}
      >
        <IconGripHorizontal className="size-4" stroke={2} aria-hidden="true" />
      </button>

      <span
        className="
          min-w-0 flex-1 truncate font-mono text-xs text-gray-800
          dark:text-gray-200
        "
      >
        {keyword}
      </span>

      <button
        type="button"
        onClick={() => onRemove(keyword)}
        className="
          inline-flex size-7 shrink-0 items-center justify-center rounded-md
          border border-transparent text-gray-400 transition
          hover:text-red-500
          dark:text-gray-500
          dark:hover:text-red-300
        "
        aria-label={`Remove ${keyword}`}
      >
        <IconX className="size-4" stroke={2} aria-hidden="true" />
      </button>
    </li>
  )
}
```

- [ ] **Step 4: Remove `sensors` and old `handleDragEnd` from the dashboard component**

Delete:

```ts
const sensors = useSensors(
  useSensor(PointerSensor),
  useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  }),
)
```

Delete the old `handleDragEnd`:

```ts
const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event
  if (!over || active.id === over.id) return

  setSelectedKeywords(prev => {
    const oldIndex = prev.findIndex(kw => kw === active.id)
    const newIndex = prev.findIndex(kw => kw === over.id)
    if (oldIndex < 0 || newIndex < 0) return prev
    return arrayMove(prev, oldIndex, newIndex)
  })
}
```

- [ ] **Step 5: Add `useNativeDragReorder` hook and reorder handler**

Add inside the `AdminSuggestionDashboard` component (after `canAddMore`):

```ts
const handleReorder = useCallback((fromIndex: number, toIndex: number) => {
  setSelectedKeywords(prev => arrayMove(prev, fromIndex, toIndex))
}, [])

const {
  containerProps: dragContainerProps,
  dragHandleProps,
  dragItemAttr,
  draggingIndex,
  dropIndicatorIndex,
} = useNativeDragReorder({
  itemCount: selectedKeywords.length,
  onReorder: handleReorder,
})
```

Also add `useCallback` to the import from `'react'`.

- [ ] **Step 6: Replace `DndContext`/`SortableContext` with native drag container**

Replace the block (lines 231-264):

```tsx
<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragEnd={handleDragEnd}
>
  <SortableContext
    items={selectedKeywords}
    strategy={verticalListSortingStrategy}
  >
    {selectedKeywords.length === 0
      ? (
          <div ...>
            No featured keywords yet. Add up to six.
          </div>
        )
      : (
          <ol className="space-y-2">
            {selectedKeywords.map(keyword => (
              <SortableKeywordItem
                key={keyword}
                keyword={keyword}
                onRemove={removeKeyword}
              />
            ))}
          </ol>
        )}
  </SortableContext>
</DndContext>
```

With:

```tsx
{
  selectedKeywords.length === 0 ? (
    <div
      className="
          rounded-lg border border-dashed border-gray-300/80 px-4
          py-6 text-sm text-gray-500
          dark:border-gray-700 dark:text-gray-400
        "
    >
      No featured keywords yet. Add up to six.
    </div>
  ) : (
    <ol className="space-y-2" {...dragContainerProps}>
      {selectedKeywords.map((keyword, index) => (
        <div key={keyword} {...dragItemAttr(index)}>
          {dropIndicatorIndex === index && <DropIndicator />}
          <KeywordItem
            keyword={keyword}
            onRemove={removeKeyword}
            dragHandleProps={dragHandleProps(index)}
            isDragging={draggingIndex === index}
          />
        </div>
      ))}
      {dropIndicatorIndex === selectedKeywords.length && <DropIndicator />}
    </ol>
  )
}
```

- [ ] **Step 7: Verify it compiles**

```bash
cd /Users/aozaki/GitHub/commission-index && bun run --cwd apps/admin tsc --noEmit 2>&1 | head -20
```

Expected: Clean.

- [ ] **Step 8: Commit**

```bash
git add apps/admin/src/components/AdminSuggestionDashboard.tsx
git commit -m "refactor(admin): replace dnd-kit with native drag in AdminSuggestionDashboard"
```

---

### Task 8: Remove `@dnd-kit` Dependencies

**Files:**

- Modify: `apps/admin/package.json`

- [ ] **Step 1: Remove packages**

```bash
cd /Users/aozaki/GitHub/commission-index && cd apps/admin && bun remove @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: Verify no remaining dnd-kit imports**

```bash
cd /Users/aozaki/GitHub/commission-index && grep -r "@dnd-kit" apps/admin/src/ || echo "No dnd-kit imports found — clean"
```

Expected: "No dnd-kit imports found — clean"

- [ ] **Step 3: Reinstall to verify clean lockfile**

```bash
cd /Users/aozaki/GitHub/commission-index && bun install
```

- [ ] **Step 4: Commit**

```bash
git add apps/admin/package.json bun.lock
git commit -m "chore(admin): remove @dnd-kit dependencies"
```

---

### Task 9: Lint, Type-check, and Final Verification

**Files:**

- All modified files from Tasks 1-8

- [ ] **Step 1: Run lint**

```bash
cd /Users/aozaki/GitHub/commission-index && bun run lint 2>&1 | tail -20
```

Expected: No errors. If lint issues, run `bun run lint:fix`.

- [ ] **Step 2: Run typecheck**

```bash
cd /Users/aozaki/GitHub/commission-index && bun run typecheck 2>&1 | tail -20
```

Expected: Clean across all workspaces.

- [ ] **Step 3: Run tests**

```bash
cd /Users/aozaki/GitHub/commission-index && bun run test 2>&1 | tail -20
```

Expected: All existing tests pass.

- [ ] **Step 4: Build admin**

```bash
cd /Users/aozaki/GitHub/commission-index && bun run build:admin 2>&1 | tail -20
```

Expected: Clean build.

- [ ] **Step 5: Commit any lint/type fixes**

Only if there were changes from lint:fix:

```bash
git add -A
git commit -m "fix(admin): lint fixes for native dnd migration"
```
