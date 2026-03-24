---

Redesign Plan

Problems Identified

Structural

- max-w-2xl (672px) centered content — 380px of dead space on each side at 1440px
- Horizontal inline text nav doesn't scale, wraps awkwardly on mobile
- Every page repeats "title → description → nav → content" which burns vertical space

Visual

- Form labels in ALL_CAPS — feels like legacy Bootstrap
- Native <input type="file"> looks completely out of place inside dark cards
- All cards have the same visual weight — no depth hierarchy
- Flat neutral-900 background with no layering

---

Changes

1. Layout overhaul (biggest impact)
   Before: [ empty ][ max-w-2xl content ][ empty ]
   After: [ sidebar 220px ][ max-w-3xl main content ]

- AdminRootLayout becomes a two-column grid: fixed sidebar + scrollable main
- New AdminSidebar component: app name at top, icon+label nav items, "Public Site ↗" at bottom
- Mobile: sidebar collapses to a sticky top tab bar (icons only, or horizontal scroll)

2. Sidebar navigation

- Uses existing @tabler/icons-react: IconLayoutDashboard, IconPlus, IconEdit, IconTag, IconSparkles
- Active item gets a background highlight + accent color
- "Public Site" moves to sidebar footer as an external link

3. Surface depth

- neutral-950 app shell → neutral-900 cards → neutral-800 inset areas — clear layering
- Sidebar: neutral-900 + subtle right border separating it from content

4. Form labels

- ALL_CAPS → text-xs font-medium tracking-wide text-gray-400 (same visual weight, more refined)

5. File upload (Create page)

- Replace native file input with a styled drop zone box with a "Choose file" button inside

6. Overview stat cards

- Larger numbers, smaller labels, icon per stat

---

Files touched

Modified: AdminLayout.tsx ← layout skeleton
New: AdminSidebar.tsx ← sidebar component
Removed: AdminSectionNav.tsx ← absorbed into sidebar
Modified: App.tsx ← routing wiring
Modified: AdminOverviewPage.tsx ← stat card improvements
Modified: AdminCreatePage.tsx ← file upload UI
Modified: globals.css ← new keyframes / vars if needed
Modified: ui.ts ← surface style tokens
