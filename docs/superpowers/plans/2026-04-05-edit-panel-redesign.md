# Edit Panel Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the inline full-form commission expansion with a thumbnail grid + drawer pattern, and add a keyword find-and-replace tool.

**Architecture:** Character accordion cards stay unchanged. Inside each card, the stacked `CommissionEditForm[]` list becomes a responsive `CommissionThumbnailGrid`. Clicking a thumbnail opens a `CommissionEditDrawer` (vaul) that renders the existing `CommissionEditForm` unchanged. A `KeywordReplacePopover` (Radix Popover) is added next to the search bar.

**Tech Stack:** React 19, vaul (shadcn Drawer), @radix-ui/react-popover, Tailwind CSS 4, existing admin form infrastructure.

**Spec:** `docs/superpowers/specs/2026-04-05-edit-panel-redesign.md`

---

### Task 1: Install Dependencies

**Files:**

- Modify: `apps/admin/package.json`

- [ ] **Step 1: Add vaul and @radix-ui/react-popover**

```bash
cd /Users/aozaki/GitHub/commission-index && bun add -D vaul @radix-ui/react-popover --cwd apps/admin
```

- [ ] **Step 2: Verify install**

```bash
cd /Users/aozaki/GitHub/commission-index && bun install --frozen-lockfile 2>&1 || bun install
```

Expected: Clean install, both packages in `apps/admin/package.json` dependencies.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/package.json bun.lock
git commit -m "chore(admin): add vaul and radix popover dependencies"
```

---

### Task 2: Create CommissionThumbnailGrid Component

**Files:**

- Create: `apps/admin/src/components/edit/CommissionThumbnailGrid.tsx`

This component replaces the inline `CommissionEditForm[]` inside `SortableCharacterCard`. It renders a responsive CSS grid of thumbnail cards.

- [ ] **Step 1: Create the component**

```tsx
// apps/admin/src/components/edit/CommissionThumbnailGrid.tsx
import type { CommissionRow } from '@commission-index/domain'
import { useMemo, useState } from 'react'
import { getAdminApiUrl } from '../../lib/adminApi'

interface CommissionThumbnailGridProps {
  commissions: CommissionRow[]
  selectedCommissionId: number | null
  onSelect: (commission: CommissionRow) => void
}

function buildThumbnailSrc(fileName: string) {
  return getAdminApiUrl(`/api/admin/source-image/${encodeURIComponent(fileName)}`)
}

function ThumbnailCard({
  commission,
  isSelected,
  onSelect,
}: {
  commission: CommissionRow
  isSelected: boolean
  onSelect: () => void
}) {
  const [errorSrc, setErrorSrc] = useState<string | null>(null)
  const imageSrc = useMemo(() => buildThumbnailSrc(commission.fileName), [commission.fileName])

  // Read cached image version from sessionStorage (shared with CommissionEditForm)
  const imageVersion = useMemo(() => {
    if (typeof window === 'undefined') return 0
    const stored = window.sessionStorage.getItem(`admin-preview-image-version:${commission.id}`)
    const parsed = Number(stored)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  }, [commission.id])

  const previewSrc = imageVersion > 0 ? `${imageSrc}?v=${imageVersion}` : imageSrc

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`
        group overflow-hidden rounded-lg border text-left transition
        hover:shadow-md
        focus-visible:ring-2 focus-visible:ring-blue-500
        focus-visible:ring-offset-2 focus-visible:ring-offset-white
        focus-visible:outline-none
        dark:focus-visible:ring-offset-gray-900
        ${
          isSelected
            ? `
            border-blue-500 ring-2 ring-blue-500
            dark:border-blue-400 dark:ring-blue-400
          `
            : `
            border-gray-200
            hover:border-gray-300
            dark:border-gray-700
            dark:hover:border-gray-600
          `
        }
      `}
    >
      <div
        className="
        aspect-1280/525 w-full overflow-hidden bg-gray-50
        dark:bg-gray-900/30
      "
      >
        {errorSrc === imageSrc ? (
          <div
            className="
              flex size-full items-center justify-center text-xs text-gray-400
              dark:text-gray-500
            "
          >
            No image
          </div>
        ) : (
          <img
            src={previewSrc}
            alt={commission.fileName}
            loading="lazy"
            className="
                size-full object-contain transition
                group-hover:scale-[1.02]
              "
            onError={() => setErrorSrc(imageSrc)}
          />
        )}
      </div>

      <div
        className={`
        px-2 py-1.5
        ${
          isSelected
            ? `
            bg-blue-50
            dark:bg-blue-950/30
          `
            : `
            bg-white
            dark:bg-gray-900/40
          `
        }
      `}
      >
        <p
          className={`
          truncate text-xs font-medium
          ${
            isSelected
              ? `
              text-blue-700
              dark:text-blue-300
            `
              : `
              text-gray-700
              dark:text-gray-200
            `
          }
        `}
        >
          {commission.fileName}
        </p>
        <p
          className="
          text-xs text-gray-400
          dark:text-gray-500
        "
        >
          {commission.links.length} {commission.links.length === 1 ? 'link' : 'links'}
        </p>
      </div>
    </button>
  )
}

export function CommissionThumbnailGrid({
  commissions,
  selectedCommissionId,
  onSelect,
}: CommissionThumbnailGridProps) {
  if (commissions.length === 0) {
    return (
      <p
        className="
        py-4 text-sm text-gray-500
        dark:text-gray-300
      "
      >
        No commissions recorded yet.
      </p>
    )
  }

  return (
    <div
      className="
      grid grid-cols-2 gap-3
      sm:grid-cols-3
    "
    >
      {commissions.map(commission => (
        <ThumbnailCard
          key={commission.id}
          commission={commission}
          isSelected={selectedCommissionId === commission.id}
          onSelect={() => onSelect(commission)}
        />
      ))}
    </div>
  )
}

export function CommissionThumbnailGridSkeleton() {
  return (
    <div
      className="
      grid grid-cols-2 gap-3
      sm:grid-cols-3
    "
    >
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700"
        >
          <div
            className="
            aspect-1280/525 w-full animate-pulse bg-gray-200/80
            dark:bg-gray-800
          "
          />
          <div className="space-y-1 px-2 py-1.5">
            <div
              className="
              h-3.5 w-3/4 animate-pulse rounded bg-gray-200/80
              dark:bg-gray-800
            "
            />
            <div
              className="
              h-3 w-1/3 animate-pulse rounded bg-gray-200/80
              dark:bg-gray-800
            "
            />
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/aozaki/GitHub/commission-index && bun run --cwd apps/admin tsc --noEmit 2>&1 | head -20
```

Expected: No errors related to CommissionThumbnailGrid.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/components/edit/CommissionThumbnailGrid.tsx
git commit -m "feat(admin): add CommissionThumbnailGrid component"
```

---

### Task 3: Create CommissionEditDrawer Component

**Files:**

- Create: `apps/admin/src/components/edit/CommissionEditDrawer.tsx`
- Modify: `apps/admin/src/styles/globals.css` (add drawer animation keyframes)

This component wraps `CommissionEditForm` inside a vaul Drawer with frosted glass backdrop.

- [ ] **Step 1: Add drawer animation keyframes to globals.css**

Add after the existing `@keyframes dialogEnter` block in `apps/admin/src/styles/globals.css`:

```css
@keyframes drawerSlideIn {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

@keyframes drawerSlideOut {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(100%);
  }
}
```

- [ ] **Step 2: Create the drawer component**

```tsx
// apps/admin/src/components/edit/CommissionEditDrawer.tsx
import type {
  AdminCommissionSearchRow,
  CharacterRow,
  CommissionRow,
} from '@commission-index/domain'
import { IconX } from '@tabler/icons-react'
import { Drawer } from 'vaul'
import { CommissionEditForm } from './CommissionEditForm'

interface CommissionEditDrawerProps {
  characters: CharacterRow[]
  commission: CommissionRow | null
  commissionSearchRows: AdminCommissionSearchRow[]
  onClose: () => void
  onDelete: () => void
  onSaveSuccess: (updated: CommissionRow) => void
  open: boolean
}

export function CommissionEditDrawer({
  characters,
  commission,
  commissionSearchRows,
  onClose,
  onDelete,
  onSaveSuccess,
  open,
}: CommissionEditDrawerProps) {
  return (
    <Drawer.Root
      open={open}
      onOpenChange={isOpen => {
        if (!isOpen) onClose()
      }}
      direction="right"
    >
      <Drawer.Portal>
        <Drawer.Overlay
          className="
            fixed inset-0 z-40 bg-black/15 backdrop-blur-sm
          "
        />
        <Drawer.Content
          aria-describedby={undefined}
          className="
            fixed top-0 right-0 bottom-0 z-50 flex w-full flex-col
            bg-white shadow-2xl outline-none
            sm:max-w-lg sm:rounded-l-2xl
            dark:bg-gray-950
          "
        >
          <div
            className="
            flex shrink-0 items-center justify-between border-b
            border-gray-200 px-5 py-4
            dark:border-gray-800
          "
          >
            <Drawer.Title className="min-w-0 flex-1">
              <p
                className="
                truncate text-base font-semibold text-gray-900
                dark:text-gray-100
              "
              >
                {commission?.fileName ?? ''}
              </p>
              <p
                className="
                truncate text-sm text-gray-500
                dark:text-gray-400
              "
              >
                {commission?.characterName ?? ''}
              </p>
            </Drawer.Title>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close drawer"
              className="
                ml-3 inline-flex size-8 shrink-0 items-center
                justify-center rounded-lg bg-gray-100 text-gray-600
                transition
                hover:bg-gray-200 hover:text-gray-900
                focus-visible:ring-2 focus-visible:ring-gray-400
                focus-visible:ring-offset-2 focus-visible:ring-offset-white
                focus-visible:outline-none
                dark:bg-gray-800 dark:text-gray-300
                dark:hover:bg-gray-700 dark:hover:text-gray-100
                dark:focus-visible:ring-offset-gray-950
              "
            >
              <IconX className="size-4" stroke={2} aria-hidden="true" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            {commission ? (
              <CommissionEditForm
                key={commission.id}
                characters={characters}
                commission={commission}
                commissionSearchRows={commissionSearchRows}
                onDelete={onDelete}
                onSaveSuccess={onSaveSuccess}
              />
            ) : null}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
```

- [ ] **Step 3: Verify it compiles**

```bash
cd /Users/aozaki/GitHub/commission-index && bun run --cwd apps/admin tsc --noEmit 2>&1 | head -20
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/components/edit/CommissionEditDrawer.tsx apps/admin/src/styles/globals.css
git commit -m "feat(admin): add CommissionEditDrawer with frosted glass backdrop"
```

---

### Task 4: Wire Drawer State into CommissionManager

**Files:**

- Modify: `apps/admin/src/components/edit/CommissionManager.tsx`

Add drawer open/close state and selected commission tracking. Render `CommissionEditDrawer` alongside the existing content.

- [ ] **Step 1: Add state and imports**

At the top of `CommissionManager.tsx`, add imports:

```tsx
// Add to existing imports
import { CommissionEditDrawer } from './CommissionEditDrawer'
```

Inside the `CommissionManager` component function (after the existing `loadError` state around line 54), add:

```tsx
const [selectedCommission, setSelectedCommission] = useState<CommissionRow | null>(null)
```

- [ ] **Step 2: Add drawer open/close handlers**

After `handleCommissionSaved` (around line 285), add:

```tsx
const handleSelectCommission = useCallback((commission: CommissionRow) => {
  setSelectedCommission(commission)
}, [])

const handleCloseDrawer = useCallback(() => {
  setSelectedCommission(null)
}, [])

const handleDrawerDelete = useCallback(() => {
  if (!selectedCommission) return
  setLoadedCommissions(previous => previous.filter(c => c.id !== selectedCommission.id))
  handleDeleteCommission(selectedCommission.characterId, selectedCommission.id)
  setSelectedCommission(null)
}, [handleDeleteCommission, selectedCommission])

const handleDrawerSaveSuccess = useCallback(
  (updated: CommissionRow) => {
    handleCommissionSaved(updated)
    // Keep drawer open with updated data
    setSelectedCommission(updated)
  },
  [handleCommissionSaved],
)
```

- [ ] **Step 3: Render CommissionEditDrawer**

After the `<CharacterDeleteDialog>` closing tag (around line 473), add:

```tsx
<CommissionEditDrawer
  open={selectedCommission !== null}
  commission={selectedCommission}
  characters={orderedCharacters}
  commissionSearchRows={commissionSearchRows}
  onClose={handleCloseDrawer}
  onDelete={handleDrawerDelete}
  onSaveSuccess={handleDrawerSaveSuccess}
/>
```

- [ ] **Step 4: Pass selectedCommissionId and onSelect to SortableCharacterCard**

In the `SortableCharacterCard` rendering (around lines 424-454), add two new props:

```tsx
selectedCommissionId={selectedCommission?.id ?? null}
onSelectCommission={handleSelectCommission}
```

(These props don't exist yet on `SortableCharacterCard` — we'll add them in Task 5.)

- [ ] **Step 5: Verify it compiles**

```bash
cd /Users/aozaki/GitHub/commission-index && bun run --cwd apps/admin tsc --noEmit 2>&1 | head -20
```

Expected: Type errors for the new SortableCharacterCard props (not yet added). That's expected — they'll be resolved in Task 5.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/components/edit/CommissionManager.tsx
git commit -m "feat(admin): wire drawer state into CommissionManager"
```

---

### Task 5: Refactor SortableCharacterCard to Use Thumbnail Grid

**Files:**

- Modify: `apps/admin/src/components/edit/SortableCharacterCard.tsx`

Replace the inline `CommissionEditForm` list with `CommissionThumbnailGrid`. Remove the old skeleton. Accept new props for drawer integration.

- [ ] **Step 1: Update imports**

Replace the `CommissionEditForm` import with:

```tsx
import { CommissionThumbnailGrid, CommissionThumbnailGridSkeleton } from './CommissionThumbnailGrid'
```

Remove the `CommissionEditForm` import. Remove the `CommissionEditFormSkeleton` function definition (lines 13-47).

- [ ] **Step 2: Update the interface**

In `SortableCharacterCardProps` (lines 49-73):

Remove these props (no longer needed — form rendering moves to the drawer):

- `charactersForSelect`
- `commissionSearchRows`
- `onDeleteCommission`
- `onSaveSuccess`

Add these new props:

```tsx
onSelectCommission: (commission: CommissionRow) => void
selectedCommissionId: number | null
```

- [ ] **Step 3: Update the component body**

Remove the destructured props that were deleted. Add the new ones.

- [ ] **Step 4: Replace the expanded panel content**

Find the expanded panel content section (currently lines 334-380). Replace the skeleton and form rendering with:

```tsx
{
  /* Show skeleton only while the card is open and loading */
}
{
  isOpen && (isCommissionsLoading || !isCommissionsLoaded) ? (
    <div className="py-4">
      <CommissionThumbnailGridSkeleton />
    </div>
  ) : null
}

{
  /* Thumbnail grid once loaded */
}
{
  isCommissionsLoaded && !isCommissionsLoading ? (
    <div className="py-4">
      <CommissionThumbnailGrid
        commissions={commissionList}
        selectedCommissionId={selectedCommissionId}
        onSelect={onSelectCommission}
      />
    </div>
  ) : null
}
```

- [ ] **Step 5: Update CommissionManager to match new props**

Go back to `CommissionManager.tsx` and remove the props that `SortableCharacterCard` no longer accepts:

- Remove `charactersForSelect={orderedCharacters}`
- Remove `commissionSearchRows={commissionSearchRows}`
- Remove the `onDeleteCommission` inline callback
- Remove `onSaveSuccess={handleCommissionSaved}`

These are now handled by the drawer callbacks added in Task 4.

- [ ] **Step 6: Verify it compiles**

```bash
cd /Users/aozaki/GitHub/commission-index && bun run --cwd apps/admin tsc --noEmit 2>&1 | head -20
```

Expected: Clean — no type errors.

- [ ] **Step 7: Verify dev server works**

```bash
cd /Users/aozaki/GitHub/commission-index && bun run dev:admin &
sleep 3
curl -s http://localhost:4174/ | head -5
kill %1
```

Expected: HTML response with the admin SPA shell.

- [ ] **Step 8: Commit**

```bash
git add apps/admin/src/components/edit/SortableCharacterCard.tsx apps/admin/src/components/edit/CommissionManager.tsx
git commit -m "refactor(admin): replace inline commission forms with thumbnail grid + drawer"
```

---

### Task 6: Create KeywordReplacePopover Component

**Files:**

- Create: `apps/admin/src/components/edit/KeywordReplacePopover.tsx`

A Radix Popover with find/replace inputs, match preview, and batch update execution.

- [ ] **Step 1: Create the component**

```tsx
// apps/admin/src/components/edit/KeywordReplacePopover.tsx
import type { AdminCommissionSearchRow } from '@commission-index/domain'
import * as Popover from '@radix-ui/react-popover'
import { IconReplace, IconX } from '@tabler/icons-react'
import { useCallback, useMemo, useState, useTransition } from 'react'
import { formControlStyles } from '../../app/ui'
import { getAdminApiUrl } from '../../lib/adminApi'

interface KeywordReplacePopoverProps {
  commissionSearchRows: AdminCommissionSearchRow[]
  onComplete: () => void
}

interface MatchedCommission {
  id: number
  characterName: string
  fileName: string
  currentKeyword: string
  newKeyword: string
}

function findMatches(rows: AdminCommissionSearchRow[], findTerm: string): MatchedCommission[] {
  if (!findTerm.trim()) return []

  const needle = findTerm.trim().toLowerCase()
  const matches: MatchedCommission[] = []

  for (const row of rows) {
    if (!row.keyword) continue
    if (row.keyword.toLowerCase().includes(needle)) {
      matches.push({
        id: row.id,
        characterName: row.characterName,
        fileName: row.fileName,
        currentKeyword: row.keyword,
        newKeyword: row.keyword, // placeholder, set during replace
      })
    }
  }

  return matches
}

function computeReplacement(currentKeyword: string, findTerm: string, replaceTerm: string): string {
  // Case-insensitive replacement, preserving surrounding structure
  const regex = new RegExp(findTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
  return currentKeyword.replace(regex, replaceTerm.trim())
}

export function KeywordReplacePopover({
  commissionSearchRows,
  onComplete,
}: KeywordReplacePopoverProps) {
  const [open, setOpen] = useState(false)
  const [findTerm, setFindTerm] = useState('')
  const [replaceTerm, setReplaceTerm] = useState('')
  const [isPending, startTransition] = useTransition()
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const matches = useMemo(
    () => findMatches(commissionSearchRows, findTerm),
    [commissionSearchRows, findTerm],
  )

  const matchesWithPreview = useMemo(
    () =>
      matches.map(m => ({
        ...m,
        newKeyword: computeReplacement(m.currentKeyword, findTerm, replaceTerm),
      })),
    [matches, findTerm, replaceTerm],
  )

  const handleReplaceAll = useCallback(() => {
    if (matchesWithPreview.length === 0) return

    setError(null)
    startTransition(async () => {
      for (let i = 0; i < matchesWithPreview.length; i++) {
        const match = matchesWithPreview[i]
        setProgress({ current: i + 1, total: matchesWithPreview.length })

        try {
          const response = await fetch(getAdminApiUrl(`/api/admin/commissions/${match.id}`), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keyword: match.newKeyword }),
          })

          if (!response.ok) {
            const body = await response.json().catch(() => ({}))
            setError(
              `Failed on "${match.fileName}": ${(body as { message?: string }).message ?? response.statusText}`,
            )
            return
          }
        } catch {
          setError(`Network error on "${match.fileName}"`)
          return
        }
      }

      // All succeeded
      setProgress(null)
      setFindTerm('')
      setReplaceTerm('')
      setOpen(false)
      onComplete()
    })
  }, [matchesWithPreview, onComplete])

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen && isPending) return // prevent close during operation
    setOpen(isOpen)
    if (!isOpen) {
      setFindTerm('')
      setReplaceTerm('')
      setProgress(null)
      setError(null)
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="
            inline-flex items-center gap-1.5 rounded-lg border
            border-gray-200 bg-white/80 px-3 py-2.5 text-sm
            font-medium text-gray-600 shadow-sm transition
            hover:border-gray-300 hover:text-gray-900
            focus-visible:ring-2 focus-visible:ring-gray-500
            focus-visible:ring-offset-2 focus-visible:ring-offset-white
            focus-visible:outline-none
            dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-300
            dark:hover:border-gray-600 dark:hover:text-gray-100
            dark:focus-visible:ring-offset-gray-900
          "
        >
          <IconReplace className="size-4" stroke={1.8} aria-hidden="true" />
          <span
            className="
            hidden
            sm:inline
          "
          >
            Keyword
          </span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="end"
          sideOffset={8}
          className="
            z-50 w-[380px] overflow-hidden rounded-xl border
            border-gray-200 bg-white shadow-lg
            dark:border-gray-700 dark:bg-gray-950
          "
        >
          {/* Header with inputs */}
          <div className="space-y-3 border-b border-gray-100 p-4 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <h3
                className="
                text-sm font-semibold text-gray-900
                dark:text-gray-100
              "
              >
                Keyword Find & Replace
              </h3>
              <Popover.Close
                aria-label="Close"
                className="
                  inline-flex size-6 items-center justify-center rounded-md
                  text-gray-400 transition
                  hover:text-gray-600
                  dark:hover:text-gray-200
                "
              >
                <IconX className="size-3.5" stroke={2} aria-hidden="true" />
              </Popover.Close>
            </div>

            <div className="space-y-2">
              <div>
                <label
                  className="
                  mb-1 block text-xs font-semibold uppercase tracking-wide
                  text-gray-500
                  dark:text-gray-400
                "
                >
                  Find
                </label>
                <input
                  type="text"
                  value={findTerm}
                  onChange={e => setFindTerm(e.target.value)}
                  disabled={isPending}
                  placeholder="e.g. yukata"
                  className={formControlStyles}
                />
              </div>
              <div>
                <label
                  className="
                  mb-1 block text-xs font-semibold uppercase tracking-wide
                  text-gray-500
                  dark:text-gray-400
                "
                >
                  Replace with
                </label>
                <input
                  type="text"
                  value={replaceTerm}
                  onChange={e => setReplaceTerm(e.target.value)}
                  disabled={isPending}
                  placeholder="e.g. kimono"
                  className={formControlStyles}
                />
              </div>
            </div>
          </div>

          {/* Match preview */}
          {findTerm.trim() && (
            <div
              className="
              max-h-48 overflow-y-auto border-b border-gray-100 p-4
              dark:border-gray-800
            "
            >
              {matchesWithPreview.length === 0 ? (
                <p
                  className="
                    text-xs text-gray-500
                    dark:text-gray-400
                  "
                >
                  No commissions match.
                </p>
              ) : (
                <>
                  <p
                    className="
                      mb-2 text-xs font-semibold text-gray-600
                      dark:text-gray-300
                    "
                  >
                    {matchesWithPreview.length} commission
                    {matchesWithPreview.length !== 1 ? 's' : ''} matched
                  </p>
                  <div className="space-y-1.5">
                    {matchesWithPreview.map(match => (
                      <div
                        key={match.id}
                        className="
                            flex items-center gap-2 rounded-md border
                            border-gray-100 bg-gray-50 px-2.5 py-1.5
                            dark:border-gray-800 dark:bg-gray-900/40
                          "
                      >
                        <span
                          className="
                            flex-1 truncate text-xs text-gray-600
                            dark:text-gray-300
                          "
                        >
                          {match.fileName}
                        </span>
                        <span
                          className="
                            shrink-0 text-xs text-gray-400 line-through
                            dark:text-gray-500
                          "
                        >
                          {match.currentKeyword}
                        </span>
                        <span
                          className="
                            shrink-0 text-xs text-emerald-600
                            dark:text-emerald-400
                          "
                        >
                          {match.newKeyword}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              className="
              border-b border-red-100 bg-red-50 px-4 py-2.5
              dark:border-red-900/30 dark:bg-red-950/30
            "
            >
              <p
                className="
                text-xs text-red-600
                dark:text-red-400
              "
              >
                {error}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between p-4">
            {progress ? (
              <p
                className="
                  text-xs text-gray-500
                  dark:text-gray-400
                "
              >
                {progress.current}/{progress.total} updated…
              </p>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <Popover.Close
                disabled={isPending}
                className="
                  inline-flex h-8 items-center rounded-md border
                  border-gray-200 px-3 text-xs font-medium text-gray-600
                  transition
                  hover:bg-gray-50
                  disabled:cursor-not-allowed disabled:opacity-60
                  dark:border-gray-700 dark:text-gray-300
                  dark:hover:bg-gray-800
                "
              >
                Cancel
              </Popover.Close>
              <button
                type="button"
                onClick={handleReplaceAll}
                disabled={isPending || matchesWithPreview.length === 0 || !replaceTerm.trim()}
                className="
                  inline-flex h-8 items-center rounded-md bg-gray-900 px-3
                  text-xs font-semibold text-white transition
                  hover:bg-gray-800
                  disabled:cursor-not-allowed disabled:opacity-60
                  dark:bg-gray-100 dark:text-gray-900
                  dark:hover:bg-gray-200
                "
              >
                Replace all
              </button>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/aozaki/GitHub/commission-index && bun run --cwd apps/admin tsc --noEmit 2>&1 | head -20
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/components/edit/KeywordReplacePopover.tsx
git commit -m "feat(admin): add KeywordReplacePopover for batch keyword editing"
```

---

### Task 7: Wire KeywordReplacePopover into CommissionManager

**Files:**

- Modify: `apps/admin/src/components/edit/CommissionManager.tsx`

Add the popover next to the search bar, and wire the `onComplete` callback to refresh bootstrap data.

- [ ] **Step 1: Add import**

```tsx
import { KeywordReplacePopover } from './KeywordReplacePopover'
```

- [ ] **Step 2: Add a refresh callback**

The keyword replace modifies data on the server. After completion, we need to signal that bootstrap data is stale. Add after the `handleCloseDrawer` callback:

```tsx
const handleKeywordReplaceComplete = useCallback(() => {
  notifyDataUpdate()
  markPendingRebuild()
  // Force a full page reload to get fresh bootstrap data.
  // This is simpler than trying to surgically update commissionSearchRows
  // since the replace can affect commissions across multiple characters.
  window.location.reload()
}, [])
```

This requires importing `notifyDataUpdate` and `markPendingRebuild`. Check if they're already imported — they should be available from other parts of the file. If not, add:

```tsx
import { notifyDataUpdate } from '../../lib/dataUpdateSignal'
import { markPendingRebuild } from '../../lib/pendingRebuildSignal'
```

- [ ] **Step 3: Render the popover next to the search bar**

Find the search bar `<div className="space-y-2">` wrapper (around line 336). Wrap the search input and the popover together:

Replace the search input container with:

```tsx
<div className="space-y-2">
  <div className="flex gap-2">
    <div className="relative flex-1">
      {/* existing IconSearch + input + clear button — unchanged */}
    </div>
    <KeywordReplacePopover
      commissionSearchRows={commissionSearchRows}
      onComplete={handleKeywordReplaceComplete}
    />
  </div>

  {/* existing search results count — unchanged */}
</div>
```

The search input `<div className="relative">` becomes `<div className="relative flex-1">` to share the row with the popover trigger button.

- [ ] **Step 4: Verify it compiles**

```bash
cd /Users/aozaki/GitHub/commission-index && bun run --cwd apps/admin tsc --noEmit 2>&1 | head -20
```

Expected: Clean.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/components/edit/CommissionManager.tsx
git commit -m "feat(admin): wire KeywordReplacePopover into edit page search bar"
```

---

### Task 8: Lint, Type-check, and Final Verification

**Files:**

- All modified files from Tasks 1-7

- [ ] **Step 1: Run lint**

```bash
cd /Users/aozaki/GitHub/commission-index && bun run lint 2>&1 | tail -20
```

Expected: No errors. If there are lint issues, fix them.

- [ ] **Step 2: Run lint:fix if needed**

```bash
cd /Users/aozaki/GitHub/commission-index && bun run lint:fix
```

- [ ] **Step 3: Run typecheck**

```bash
cd /Users/aozaki/GitHub/commission-index && bun run typecheck 2>&1 | tail -20
```

Expected: Clean across all workspaces.

- [ ] **Step 4: Run tests**

```bash
cd /Users/aozaki/GitHub/commission-index && bun run test 2>&1 | tail -20
```

Expected: All existing tests pass.

- [ ] **Step 5: Build admin**

```bash
cd /Users/aozaki/GitHub/commission-index && bun run build:admin 2>&1 | tail -20
```

Expected: Clean build.

- [ ] **Step 6: Commit any lint/type fixes**

```bash
git add -A
git commit -m "fix(admin): lint and type fixes for edit panel redesign"
```

(Only if there were changes from Steps 1-2.)

---

### Task 9: Manual Smoke Test

This task is for the human operator — not automated.

- [ ] **Step 1: Start dev server**

```bash
cd /Users/aozaki/GitHub/commission-index && bun run dev:admin
```

- [ ] **Step 2: Verify thumbnail grid**

Navigate to http://localhost:4174/edit. Expand a character card. Verify:

- Commissions display as a 3-column thumbnail grid (2-column on narrow viewport)
- Each thumbnail shows the source image, file name, and link count
- Loading skeleton appears while commissions load

- [ ] **Step 3: Verify drawer**

Click a thumbnail. Verify:

- Right-side drawer slides in with frosted glass backdrop
- Drawer header shows file name and character name
- Full edit form renders inside the drawer body (all fields, image preview, save/delete)
- Save changes works — thumbnail grid updates without page reload
- Close button and Escape key close the drawer
- Clicking a different thumbnail while drawer is open switches to the new commission

- [ ] **Step 4: Verify keyword replace**

Click the "Keyword" button next to the search bar. Verify:

- Popover opens with Find and Replace inputs
- Typing in Find shows matching commissions with preview
- "Replace all" executes and page reloads with updated data

- [ ] **Step 5: Verify mobile**

Resize browser to ~375px width. Verify:

- Thumbnail grid shows 2 columns
- Drawer becomes a bottom sheet (vaul default mobile behavior)
