# Admin Edit Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the desktop right-side drawer with a centered modal dialog for commission editing, keeping the mobile bottom drawer unchanged.

**Architecture:** The existing `CommissionEditDrawer.tsx` already uses `useIsDesktop()` to branch between right (desktop) and bottom (mobile) Vaul drawers. We add `@radix-ui/react-dialog` as a direct dependency and build a thin `ui/dialog.tsx` primitive. Then we refactor `CommissionEditDrawer.tsx` to render Radix Dialog on desktop and keep Vaul Drawer on mobile, both wrapping the same `CommissionEditForm`.

**Tech Stack:** React 19, @radix-ui/react-dialog, Vaul (mobile only), Tailwind CSS 4

---

### Task 1: Add `@radix-ui/react-dialog` as a direct dependency

**Files:**

- Modify: `apps/admin/package.json`

- [ ] **Step 1: Install the package**

Run:

```bash
cd /Users/aozaki/GitHub/commission-index && bun add @radix-ui/react-dialog --cwd apps/admin
```

- [ ] **Step 2: Verify installation**

Run:

```bash
cd /Users/aozaki/GitHub/commission-index && bun run --cwd apps/admin typecheck 2>&1 | tail -5
```

Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/package.json bun.lock
git commit -m "chore(admin): add @radix-ui/react-dialog as direct dependency"
```

---

### Task 2: Create `ui/dialog.tsx` primitive

**Files:**

- Create: `apps/admin/src/components/ui/dialog.tsx`

This follows the same pattern as the existing `ui/select.tsx` — thin wrappers around Radix primitives with project-consistent Tailwind classes.

- [ ] **Step 1: Create the dialog primitive component**

```tsx
// apps/admin/src/components/ui/dialog.tsx
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { IconX } from '@tabler/icons-react'
import * as React from 'react'
import { cn } from '../../lib/cn'

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogClose = DialogPrimitive.Close
const DialogPortal = DialogPrimitive.Portal

function DialogOverlay({
  ref,
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay> & {
  ref?: React.RefObject<React.ComponentRef<typeof DialogPrimitive.Overlay> | null>
}) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        `
          fixed inset-0 z-60 bg-black/15 backdrop-blur-sm
          data-[state=open]:animate-in data-[state=open]:fade-in-0
          data-[state=closed]:animate-out data-[state=closed]:fade-out-0
        `,
        className,
      )}
      {...props}
    />
  )
}
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

function DialogContent({
  ref,
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  ref?: React.RefObject<React.ComponentRef<typeof DialogPrimitive.Content> | null>
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          `
            fixed top-1/2 left-1/2 z-70 flex max-h-[85vh] w-full max-w-2xl
            -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl bg-white
            shadow-2xl outline-none
            data-[state=open]:animate-in data-[state=open]:fade-in-0
            data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-left-1/2
            data-[state=open]:slide-in-from-top-[48%]
            data-[state=closed]:animate-out data-[state=closed]:fade-out-0
            data-[state=closed]:zoom-out-95 data-[state=closed]:slide-out-to-left-1/2
            data-[state=closed]:slide-out-to-top-[48%]
            dark:bg-gray-950
          `,
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}
DialogContent.displayName = DialogPrimitive.Content.displayName

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        `
          flex shrink-0 items-center justify-between border-b
          border-gray-200 px-5 py-4
          dark:border-gray-800
        `,
        className,
      )}
      {...props}
    />
  )
}

function DialogTitle({
  ref,
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title> & {
  ref?: React.RefObject<React.ComponentRef<typeof DialogPrimitive.Title> | null>
}) {
  return <DialogPrimitive.Title ref={ref} className={cn('min-w-0 flex-1', className)} {...props} />
}
DialogTitle.displayName = DialogPrimitive.Title.displayName

function DialogCloseButton({
  className,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <DialogClose asChild>
      <button
        type="button"
        aria-label="Close dialog"
        className={cn(
          `
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
          `,
          className,
        )}
        onClick={onClick}
        {...props}
      >
        <IconX className="size-4" stroke={2} aria-hidden="true" />
      </button>
    </DialogClose>
  )
}

export {
  Dialog,
  DialogClose,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
```

- [ ] **Step 2: Verify typecheck passes**

Run:

```bash
cd /Users/aozaki/GitHub/commission-index && bun run --cwd apps/admin typecheck 2>&1 | tail -5
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/components/ui/dialog.tsx
git commit -m "feat(admin): add Dialog UI primitive based on Radix Dialog"
```

---

### Task 3: Add `tailwindcss-animate` entrance/exit keyframes

The Radix Dialog data-state animations (`animate-in`, `fade-in-0`, `zoom-in-95`, `slide-in-from-*`) require `tailwindcss-animate` utilities. Check if they're already available.

**Files:**

- Possibly modify: `apps/admin/package.json`, `apps/admin/src/app.css` or Tailwind config

- [ ] **Step 1: Check if tailwindcss-animate is installed**

Run:

```bash
cd /Users/aozaki/GitHub/commission-index && grep -r "tailwindcss-animate" apps/admin/package.json bun.lock 2>/dev/null | head -5
```

If not installed, check if the admin CSS already has custom keyframes for dialog animations. If neither exists, we have two options:

1. Install `tailwindcss-animate`
2. Write minimal custom keyframes inline

If `tailwindcss-animate` is not present, add manual keyframes to `apps/admin/src/app.css`:

```css
@keyframes dialog-overlay-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes dialog-content-in {
  from {
    opacity: 0;
    transform: translate(-50%, -48%) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}
@keyframes dialog-content-out {
  from {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  to {
    opacity: 0;
    transform: translate(-50%, -48%) scale(0.95);
  }
}
```

And update `dialog.tsx` to use these instead of tailwindcss-animate classes:

For `DialogOverlay`:

```
data-[state=open]:animate-[dialog-overlay-in_150ms_ease-out]
data-[state=closed]:animate-[dialog-overlay-in_150ms_ease-in_reverse]
```

For `DialogContent`:

```
data-[state=open]:animate-[dialog-content-in_200ms_ease-out]
data-[state=closed]:animate-[dialog-content-out_150ms_ease-in]
```

- [ ] **Step 2: Verify build works**

Run:

```bash
cd /Users/aozaki/GitHub/commission-index && bun run build:admin 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 3: Commit (if changes were needed)**

```bash
git add -A
git commit -m "style(admin): add dialog entrance/exit animation keyframes"
```

---

### Task 4: Refactor `CommissionEditDrawer.tsx` — desktop Dialog, mobile Drawer

This is the core change. The component conditionally renders Radix Dialog on desktop and Vaul Drawer on mobile. Both wrap identical header + form content.

**Files:**

- Modify: `apps/admin/src/components/edit/CommissionEditDrawer.tsx`

- [ ] **Step 1: Rewrite CommissionEditDrawer.tsx**

```tsx
// apps/admin/src/components/edit/CommissionEditDrawer.tsx
import type {
  AdminCommissionSearchRow,
  CharacterRow,
  CommissionRow,
} from '@commission-index/domain'
import { IconX } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { Drawer } from 'vaul'
import { Dialog, DialogCloseButton, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { CommissionEditForm } from './CommissionEditForm'

const SM_BREAKPOINT = '(min-width: 640px)'

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(SM_BREAKPOINT).matches,
  )

  useEffect(() => {
    const mql = window.matchMedia(SM_BREAKPOINT)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return isDesktop
}

interface CommissionEditDrawerProps {
  characters: CharacterRow[]
  commission: CommissionRow | null
  commissionSearchRows: AdminCommissionSearchRow[]
  onClose: () => void
  onDelete: () => void
  onSaveSuccess: (updated: CommissionRow) => void
  open: boolean
}

// 共用的标题区和表单内容
function EditPanelHeader({
  commission,
  onClose,
}: {
  commission: CommissionRow | null
  onClose: () => void
}) {
  return (
    <>
      <div className="min-w-0 flex-1">
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
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
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
    </>
  )
}

function EditPanelBody({
  characters,
  commission,
  commissionSearchRows,
  onDelete,
  onSaveSuccess,
}: {
  characters: CharacterRow[]
  commission: CommissionRow | null
  commissionSearchRows: AdminCommissionSearchRow[]
  onDelete: () => void
  onSaveSuccess: (updated: CommissionRow) => void
}) {
  if (!commission) return null
  return (
    <CommissionEditForm
      key={commission.id}
      characters={characters}
      commission={commission}
      commissionSearchRows={commissionSearchRows}
      onDelete={onDelete}
      onSaveSuccess={onSaveSuccess}
    />
  )
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
  const isDesktop = useIsDesktop()

  if (isDesktop) {
    return (
      <Dialog
        open={open}
        onOpenChange={isOpen => {
          if (!isOpen) onClose()
        }}
      >
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
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
            </DialogTitle>
            <DialogCloseButton />
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <EditPanelBody
              characters={characters}
              commission={commission}
              commissionSearchRows={commissionSearchRows}
              onDelete={onDelete}
              onSaveSuccess={onSaveSuccess}
            />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // Mobile: keep Vaul bottom drawer
  return (
    <Drawer.Root
      open={open}
      onOpenChange={isOpen => {
        if (!isOpen) onClose()
      }}
      direction="bottom"
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-60 bg-black/15 backdrop-blur-sm" />
        <Drawer.Content
          aria-describedby={undefined}
          className="
            fixed right-0 bottom-0 left-0 z-70 flex max-h-[85dvh] flex-col
            rounded-t-2xl bg-white shadow-2xl outline-none
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
            <EditPanelBody
              characters={characters}
              commission={commission}
              commissionSearchRows={commissionSearchRows}
              onDelete={onDelete}
              onSaveSuccess={onSaveSuccess}
            />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
```

Note: The `EditPanelHeader` helper is not used because desktop uses `DialogHeader` + `DialogTitle` + `DialogCloseButton` (Radix primitives for accessibility), while mobile uses `Drawer.Title` (Vaul primitive). The header markup is intentionally duplicated across the two branches to keep each wrapper self-contained with its own accessibility primitives.

- [ ] **Step 2: Verify typecheck**

Run:

```bash
cd /Users/aozaki/GitHub/commission-index && bun run --cwd apps/admin typecheck 2>&1 | tail -10
```

Expected: No errors.

- [ ] **Step 3: Verify build**

Run:

```bash
cd /Users/aozaki/GitHub/commission-index && bun run build:admin 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 4: Verify lint**

Run:

```bash
cd /Users/aozaki/GitHub/commission-index && bun run lint 2>&1 | tail -10
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/components/edit/CommissionEditDrawer.tsx
git commit -m "feat(admin): use centered dialog for desktop commission editing"
```

---

### Task 5: Visual verification and cleanup

- [ ] **Step 1: Start dev server and test**

Run:

```bash
cd /Users/aozaki/GitHub/commission-index && bun run dev:admin
```

Verify manually:

1. Desktop (≥640px): Click a commission thumbnail → centered dialog appears with fade+scale animation
2. Dialog is `max-w-2xl`, vertically centered, form scrolls internally
3. Close via X button works
4. Close via clicking overlay works
5. Mobile (<640px): Bottom drawer still works, swipe to dismiss works
6. Form submission (save, delete, upload) all work as before

- [ ] **Step 2: Run full validation**

Run:

```bash
cd /Users/aozaki/GitHub/commission-index && bun run lint && bun run typecheck && bun run test
```

Expected: All pass.

- [ ] **Step 3: Clean up unused EditPanelHeader if present**

Remove `EditPanelHeader` from the file if it ended up unused (it's defined in the plan but not referenced in the final code).

- [ ] **Step 4: Final commit if cleanup was needed**

```bash
git add -A
git commit -m "chore(admin): clean up unused helpers"
```
