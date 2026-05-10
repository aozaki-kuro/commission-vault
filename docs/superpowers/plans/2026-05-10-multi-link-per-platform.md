# Multi-link per platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface every same-platform link a commission has (e.g. two Pixiv posts of the same artwork) with disambiguating `Platform N` labels, instead of silently dropping all but the first.

**Architecture:** Replace the per-platform single-URL map in `selectDisplayLinks` with a per-platform list, flatten in priority order, and append a 1-indexed numeric suffix to `type` only when a platform has ≥ 2 entries. Slot budget unchanged — each part costs one slot, truncation happens at the tail after flattening. Pure function change in one file; no template, schema, or admin changes.

**Tech Stack:** TypeScript, Vitest, ESLint (@antfu config — single quotes, no semicolons, 100-col).

**Spec:** `docs/superpowers/specs/2026-05-10-multi-link-per-platform-design.md`

---

## File Map

| File                                                        | Role                                                                                              | Change                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `apps/web/src/features/home/commission/linkDisplay.ts`      | Pure link selection logic consumed by `IllustratorInfo.astro` and the home batch payload builders | Bucket per platform, number when ≥ 2, truncate after flatten |
| `apps/web/src/features/home/commission/linkDisplay.test.ts` | Vitest suite for the above                                                                        | Add 5 tests; existing 3 stay verbatim                        |

No other file is touched. The Astro consumer reads `mainLinks[].type` as a plain string — `Pixiv 1` vs `Pixiv` flows through unchanged.

---

### Task 1: Add multipart support to `selectDisplayLinks`

**Files:**

- Modify: `apps/web/src/features/home/commission/linkDisplay.ts:36-53`
- Test: `apps/web/src/features/home/commission/linkDisplay.test.ts`

The change is a single coherent edit (data shape + label suffix + truncation order are interlocked); we drive it with a single TDD loop covering all 5 new behaviors at once.

- [ ] **Step 1: Add the 5 new tests**

Open `apps/web/src/features/home/commission/linkDisplay.test.ts` and append the following `it` blocks **inside** the existing `describe('linkDisplay', () => { ... })` block, after the existing three tests. Do not modify the existing tests.

```ts
it('numbers same-platform parts when there are multiple', () => {
  const result = selectDisplayLinks({
    links: ['https://www.pixiv.net/artworks/144567573', 'https://www.pixiv.net/artworks/144613740'],
  })

  expect(result.mainLinks).toEqual([
    { type: 'Pixiv 1', url: 'https://www.pixiv.net/artworks/144567573' },
    { type: 'Pixiv 2', url: 'https://www.pixiv.net/artworks/144613740' },
  ])
  expect(result.designLink).toBeNull()
})

it('numbers three same-platform parts and fills the slot budget', () => {
  const result = selectDisplayLinks({
    links: [
      'https://www.pixiv.net/artworks/1',
      'https://www.pixiv.net/artworks/2',
      'https://www.pixiv.net/artworks/3',
    ],
  })

  expect(result.mainLinks).toEqual([
    { type: 'Pixiv 1', url: 'https://www.pixiv.net/artworks/1' },
    { type: 'Pixiv 2', url: 'https://www.pixiv.net/artworks/2' },
    { type: 'Pixiv 3', url: 'https://www.pixiv.net/artworks/3' },
  ])
})

it('keeps priority order and numbers multipart entries within their platform', () => {
  const result = selectDisplayLinks({
    links: [
      'https://www.pixiv.net/artworks/1',
      'https://x.com/example/status/1',
      'https://www.pixiv.net/artworks/2',
    ],
  })

  expect(result.mainLinks).toEqual([
    { type: 'Twitter', url: 'https://x.com/example/status/1' },
    { type: 'Pixiv 1', url: 'https://www.pixiv.net/artworks/1' },
    { type: 'Pixiv 2', url: 'https://www.pixiv.net/artworks/2' },
  ])
})

it('truncates trailing multipart entries when a design link tightens the budget', () => {
  const result = selectDisplayLinks({
    links: [
      'https://x.com/example/status/1',
      'https://www.pixiv.net/artworks/1',
      'https://www.pixiv.net/artworks/2',
    ],
    designLink: 'https://x.com/example/status/2',
  })

  expect(result.mainLinks).toEqual([
    { type: 'Twitter', url: 'https://x.com/example/status/1' },
    { type: 'Pixiv 1', url: 'https://www.pixiv.net/artworks/1' },
  ])
  expect(result.designLink).toBe('https://x.com/example/status/2')
})

it('does not number a single same-platform link', () => {
  const result = selectDisplayLinks({
    links: ['https://www.pixiv.net/artworks/1'],
  })

  expect(result.mainLinks).toEqual([{ type: 'Pixiv', url: 'https://www.pixiv.net/artworks/1' }])
})
```

- [ ] **Step 2: Run the tests and confirm the new ones fail**

Run:

```bash
bun run --cwd apps/web vitest run src/features/home/commission/linkDisplay.test.ts
```

Expected: existing 3 tests pass, the **single same-platform link** test passes (current behavior already returns `'Pixiv'` for a single link), and the other 4 new tests fail. Failures should look like:

- `numbers same-platform parts...` — actual `mainLinks` length is `1` with type `'Pixiv'`, expected length `2` with `'Pixiv 1'` / `'Pixiv 2'`.
- `numbers three same-platform parts...` — actual length `1`, expected `3`.
- `keeps priority order...` — actual returns `Twitter` + single `Pixiv`, expected includes `Pixiv 1` and `Pixiv 2`.
- `truncates trailing multipart...` — actual returns `Twitter` + single `Pixiv` (which coincidentally also has length 2 — but the type label is `'Pixiv'`, not `'Pixiv 1'`).

If any of the existing 3 tests fail, stop — that's a regression in the test setup, not the goal of this task.

- [ ] **Step 3: Replace `selectDisplayLinks` with the multipart implementation**

Edit `apps/web/src/features/home/commission/linkDisplay.ts`. Replace the entire function body of `selectDisplayLinks` (lines 29-53 in the current file) with the version below. Leave `LINK_PRIORITY`, `COMMISSION_LINK_TEXT_CLASS`, the interfaces, and `hasDisplayableLinks` untouched.

Old (to replace):

```ts
export function selectDisplayLinks({
  links,
  designLink,
}: DisplayLinksInput): DisplayLinksSelection {
  const hasDesign = Boolean(designLink)
  const maxLinks = hasDesign ? 2 : 3

  const selected: Record<string, string> = {}
  for (const url of links) {
    for (const { type, patterns } of LINK_PRIORITY) {
      if (patterns.some(pattern => url.includes(pattern)) && !selected[type]) {
        selected[type] = url
        break
      }
    }
  }

  return {
    hasDesign,
    mainLinks: LINK_PRIORITY.filter(priority => priority.type in selected)
      .slice(0, maxLinks)
      .map(({ type }) => ({ type, url: selected[type] })),
    designLink: hasDesign ? designLink! : null,
  }
}
```

New:

```ts
export function selectDisplayLinks({
  links,
  designLink,
}: DisplayLinksInput): DisplayLinksSelection {
  const hasDesign = Boolean(designLink)
  const maxLinks = hasDesign ? 2 : 3

  const buckets: Record<string, string[]> = {}
  for (const url of links) {
    for (const { type, patterns } of LINK_PRIORITY) {
      if (patterns.some(pattern => url.includes(pattern))) {
        if (!buckets[type]) buckets[type] = []
        buckets[type].push(url)
        break
      }
    }
  }

  const flat: DisplayLink[] = []
  for (const { type } of LINK_PRIORITY) {
    const urls = buckets[type]
    if (!urls) continue
    if (urls.length === 1) {
      flat.push({ type, url: urls[0] })
    } else {
      urls.forEach((url, i) => {
        flat.push({ type: `${type} ${i + 1}`, url })
      })
    }
  }

  return {
    hasDesign,
    mainLinks: flat.slice(0, maxLinks),
    designLink: hasDesign ? designLink! : null,
  }
}
```

What changed and why:

- `selected: Record<string, string>` → `buckets: Record<string, string[]>` so the same platform can hold multiple URLs.
- The `&& !selected[type]` guard is gone — every matching URL is appended.
- Flattening happens in `LINK_PRIORITY` order (preserves cross-platform priority); within each bucket the input order is preserved (`forEach` over the array as built).
- The 1-indexed numeric suffix (`${type} ${i + 1}`) is only applied when a bucket has ≥ 2 entries; single-link platforms keep the bare label, preserving the existing visual contract.
- `slice(0, maxLinks)` runs **after** flattening, not on the platform list — so the slot budget is in parts, and the tail is truncated first.

- [ ] **Step 4: Run the tests and confirm they all pass**

Run:

```bash
bun run --cwd apps/web vitest run src/features/home/commission/linkDisplay.test.ts
```

Expected: all 8 tests pass (3 original + 5 new).

- [ ] **Step 5: Run lint and typecheck on the touched workspace**

Run:

```bash
bun run lint
bun run typecheck
```

Expected: both clean. If lint flags formatting (semicolons, quote style, trailing commas, line width), fix with `bun run lint:fix` and re-verify the tests still pass.

- [ ] **Step 6: Run the full app/web test suite to catch any consumer regression**

Run:

```bash
bun run --cwd apps/web vitest run
```

Expected: all green. Nothing else consumes `selectDisplayLinks` in a way that's sensitive to label content (the consumers — `IllustratorInfo.astro`, `homeCharacterBatchPayload.ts`, `homeTimelineBatchPayload.ts` — pass `mainLinks[].type` through as-is), but a full run confirms no incidental breakage.

- [ ] **Step 7: Commit**

Stage and commit only the two changed files. **Do not push** (project rule: never push to master). Confirm with the user before running this step if the user has set "never autocommit" in their environment — otherwise:

```bash
git add apps/web/src/features/home/commission/linkDisplay.ts \
        apps/web/src/features/home/commission/linkDisplay.test.ts
git commit -m "feat(web): show every same-platform link with numbered labels"
```

---

## Self-Review Notes

- **Spec coverage:** the five test cases map 1:1 to the five rows of the spec's behavior table that are non-trivial (`[Pixiv-1]`, `[Pixiv-1, Pixiv-2]`, three-part, `[Twitter, Pixiv-1, Pixiv-2]`, `[Twitter, Pixiv-1, Pixiv-2]` + design). The remaining spec rows (`[]`, `['no-match']`, `[Pixiv-1, Pixiv-1]` duplicate URL) are already covered or implicitly handled — `hasDisplayableLinks` empty/no-match cases are in the existing third test, and the duplicate-URL row is informational (the bucket logic naturally produces `Pixiv 1`/`Pixiv 2` for two identical URLs without any new code path; not worth a dedicated test).
- **Placeholder scan:** none. Every step has explicit code, exact paths, and exact commands.
- **Type consistency:** `DisplayLink` shape (`{ type: string, url: string }`) is unchanged. `Record<string, string[]>` is local to the function. `flat` typed as `DisplayLink[]`.
- **No structural change to consumers:** verified by reading `IllustratorInfo.astro:95-100` — it renders `link.type` as inner text, no string parsing.

---

## Execution Choice

Plan complete. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between, fast iteration
2. **Inline Execution** — execute in this session via executing-plans, with checkpoints

Which approach?
