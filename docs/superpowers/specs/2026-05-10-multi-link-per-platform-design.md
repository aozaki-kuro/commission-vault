# Multi-link per platform in commission link display

**Date:** 2026-05-10
**Scope:** `apps/web` — `linkDisplay.ts` and its tests only.

## Problem

A commission can be published as two (or more) separate posts on the same platform — most often Pixiv or Nijie — when the artist splits a single artwork into multiple posts (e.g. distinct artwork IDs like `pixiv.net/artworks/144567573` and `pixiv.net/artworks/144613740`).

The current `selectDisplayLinks` in `apps/web/src/features/home/commission/linkDisplay.ts:36-44` deduplicates by platform: the first URL matching a platform pattern is kept, all later URLs for the same platform are silently dropped. The second post is invisible.

## Goal

Surface every same-platform link a commission has, with disambiguating labels, while preserving the existing slot budget and rendering contract.

## Non-goals

- No schema change (D1 column / admin payload stays `Links: string[]`).
- No template change in `IllustratorInfo.astro` — it already maps `mainLinks[]` and renders `link.type` as the label.
- No i18n. Labels are platform names + ASCII numerals; both are locale-invariant.
- No deduplication of identical URLs — that's an admin-side data hygiene concern.

## Design

### Behavior

```
selected: Record<string, string[]>          # bucket per platform, append, no dedupe
flatten = LINK_PRIORITY order, parts in admin input order within each platform
label   = bucket.length >= 2 ? `${type} ${i+1}` : type
budget  = hasDesign ? 2 : 3                 # unchanged; each part costs 1 slot
                                            # truncate after flatten
```

Concretely the change is:

1. Replace `const selected: Record<string, string> = {}` with `Record<string, string[]>`.
2. Drop the `!selected[type]` guard; always push.
3. When building `mainLinks`, expand each bucket. If a bucket has ≥ 2 entries, suffix the type with `1`-indexed part number; otherwise use the bare type.
4. Apply `slice(0, maxLinks)` after flattening, not before — so the budget is counted in parts, not platforms.

### Behavior table

| Input `links`                         | `hasDesign` | `mainLinks` (label → url)                          |
| ------------------------------------- | ----------- | -------------------------------------------------- |
| `[Pixiv-1]`                           | false       | `Pixiv → Pixiv-1`                                  |
| `[Pixiv-1, Pixiv-2]`                  | false       | `Pixiv 1 → Pixiv-1`, `Pixiv 2 → Pixiv-2`           |
| `[Pixiv-1, Pixiv-2, Pixiv-3]`         | false       | `Pixiv 1`, `Pixiv 2`, `Pixiv 3`                    |
| `[Twitter, Pixiv-1, Pixiv-2]`         | false       | `Twitter`, `Pixiv 1`, `Pixiv 2`                    |
| `[Twitter, Pixiv-1, Pixiv-2, Fanbox]` | false       | `Twitter`, `Pixiv 1`, `Pixiv 2` (Fanbox truncated) |
| `[Twitter, Pixiv-1, Pixiv-2]`         | true        | `Twitter`, `Pixiv 1` (Pixiv 2 truncated)           |
| `[Pixiv-1, Pixiv-1]` (duplicate URL)  | false       | `Pixiv 1 → Pixiv-1`, `Pixiv 2 → Pixiv-1`           |
| `[]`                                  | any         | `[]`                                               |
| `['https://example.com/no-match']`    | false       | `[]`                                               |

`Pixiv-1`, `Pixiv-2` etc. above are placeholders for distinct artwork URLs like `https://www.pixiv.net/artworks/144567573` — the function only matches by hostname; the path is irrelevant.

### Truncation policy

Slot budget unchanged: `3` without design, `2` with design. Each part costs one slot. When a same-platform multipart group meets the cap, later parts are dropped first because flattening preserves `LINK_PRIORITY` order across platforms and source order within a platform — the cut happens at the tail.

The awkward case is `[Twitter, Pixiv-1, Pixiv-2]` + design: Pixiv 2 disappears. Acceptable because:

- Multipart commissions and design links rarely co-occur in practice.
- The admin can resolve it by removing the design link or one of the Pixiv parts.
- No layout overflow risk on the consumer template.

### Public surface

`DisplayLink`, `DisplayLinksSelection`, `DisplayLinksInput`, `selectDisplayLinks`, `hasDisplayableLinks`, `COMMISSION_LINK_TEXT_CLASS` — all signatures unchanged. The only observable difference is that `mainLinks[].type` may now end with ` 1`, ` 2`, … when multiple parts exist on one platform.

`hasDisplayableLinks` continues to work without modification because it only checks `mainLinks.length > 0 || Boolean(designLink)`, which is unaffected.

## Testing

Existing three tests in `linkDisplay.test.ts` must remain green unmodified — the single-link-per-platform paths are unchanged.

New cases:

1. Two Pixiv parts → labels `Pixiv 1`, `Pixiv 2`, both URLs preserved in input order.
2. Three Pixiv parts (no design) → fills all three slots, no other platform displayed.
3. Twitter + two Pixiv parts (no design) → `Twitter`, `Pixiv 1`, `Pixiv 2` in that order.
4. Twitter + two Pixiv parts + design → `Twitter`, `Pixiv 1` + design link; Pixiv 2 truncated.
5. Single Pixiv link → label is bare `Pixiv` (regression guard for the no-suffix branch).

## Files touched

- `apps/web/src/features/home/commission/linkDisplay.ts` — logic change.
- `apps/web/src/features/home/commission/linkDisplay.test.ts` — five new tests.

No template, schema, admin, or export changes.

## Risk and rollback

- **Blast radius:** one pure function with one consumer template; consumer reads `link.type` as a string and emits it as text — no structural assumptions.
- **Rollback:** revert two files.
- **No data migration.** Existing `Links: string[]` arrays already accommodate same-platform duplicates; pre-change deployments simply hid the second entry.
