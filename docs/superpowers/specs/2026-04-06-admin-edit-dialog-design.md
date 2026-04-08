# Admin Edit: Replace Right Drawer with Center Dialog

## Problem

The admin `/edit` page uses a right-side drawer (Vaul, `max-w-lg` / 512px) for commission editing. Because the admin content container is `max-w-2xl` (672px) and centered, the drawer sits far from the content list — requiring long mouse travel to interact with the edit form.

## Solution

Replace the desktop right drawer with a centered modal dialog. Keep the mobile bottom drawer unchanged.

## Design

### Desktop (≥640px)

- **Component:** Centered modal dialog (not a side drawer)
- **Width:** `max-w-2xl` (672px) — matches admin container width
- **Height:** `max-h-[85vh]`, internal scroll for form body
- **Overlay:** Keep existing `bg-black/15 backdrop-blur-sm`
- **Z-index:** Keep z-60 overlay / z-70 panel
- **Close:** X button or overlay click
- **Animation:** Fade in + slight scale up (standard dialog entrance)

### Mobile (<640px)

- **No change.** Keep current Vaul bottom drawer (`direction="bottom"`, `max-h-[85dvh]`, swipe to dismiss).

### Form Content

No field changes. Same layout as current drawer:

1. Image preview (1280:525 aspect ratio) with upload button
2. Character + filename fields (2-col grid)
3. Links textarea
4. Design + description fields (2-col grid)
5. Keyword field
6. Action buttons (save, hidden toggle, delete)

### Implementation Approach

**Option A — Conditional rendering by breakpoint:**
Use the existing `useMediaQuery('(min-width: 640px)')` hook. Render shadcn `Dialog` on desktop, keep Vaul `Drawer` on mobile. Both wrap the same `CommissionEditForm`.

**Option B — Style Vaul as centered dialog:**
Keep Vaul but override desktop styles to center instead of anchoring right. Vaul supports custom positioning via CSS.

**Recommended: Option A.** Cleaner separation. shadcn Dialog is not yet installed — needs `npx shadcn@latest add dialog` (adds `@radix-ui/react-dialog` + `ui/dialog.tsx`). The form component stays shared — only the container changes.

## Files to Modify

- `apps/admin/src/components/edit/CommissionEditDrawer.tsx` — main change: conditional Dialog vs Drawer rendering
- Possibly extract shared wrapper if the branching gets complex

## Out of Scope

- Field layout changes
- Mobile behavior changes
- Admin container width changes
